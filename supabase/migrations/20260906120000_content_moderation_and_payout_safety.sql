-- Preventive text moderation and atomic payout refunds.
-- Client checks improve UX; these database checks are the authoritative guard.

CREATE OR REPLACE FUNCTION public.content_moderation_reason(_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(translate(
    coalesce(_text, ''),
    'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy'
  ));
  normalized := translate(normalized, '@€31|0$57', 'aeeiiosst');
  normalized := regexp_replace(normalized, '[^a-z0-9]+', ' ', 'g');
  normalized := btrim(regexp_replace(normalized, '\s+', ' ', 'g'));

  IF normalized = '' THEN RETURN NULL; END IF;

  IF normalized ~ '\m(child|kid|minor|underage) (porn|nudes?|sex)\M'
     OR normalized ~ '\m(porn|nudes?|sex) (with )?(a )?(child|kid|minor|underage)\M'
     OR normalized ~ '\m(porno|nue?|sexe) (avec )?(un )?(enfant|mineur)e?s?\M'
     OR normalized ~ '\m(enfant|mineur)e?s? (porno|nue?s?|sexe)\M' THEN
    RETURN 'sexual_minors';
  END IF;
  IF normalized ~ '\m(childporn|pornography|pornographique|pornographie|revengeporn)\M'
     OR normalized ~ '\m(send|envoie) (me |moi )?(your |tes? )?nudes?\M'
     OR normalized ~ '\m(sexual services?|services? sexuels?)\M' THEN
    RETURN 'sexual_explicit';
  END IF;
  IF normalized ~ '\m(white power|heil hitler|race war|ethnic cleansing)\M'
     OR normalized ~ '\m(suprematie blanche|nettoyage ethnique|mort aux (juifs|musulmans|noirs|arabes|gays))\M'
     OR normalized ~ '\m(gas|exterminate|kill) (all )?(jews|muslims|blacks|arabs|gays)\M' THEN
    RETURN 'hate';
  END IF;
  IF normalized ~ '\m(i will|i m going to|im going to) (kill|murder|shoot|stab) you\M'
     OR normalized ~ '\m(je vais|j vais) (te )?(tuer|abattre|poignarder)\M'
     OR normalized ~ '\m(death threat|menace de mort)\M' THEN
    RETURN 'violent_threat';
  END IF;
  IF normalized ~ '\m(kill yourself|go kill yourself|you should kill yourself)\M'
     OR normalized ~ '\m(suicide toi|va te suicider|tue toi)\M' THEN
    RETURN 'self_harm';
  END IF;
  IF normalized ~ '\m(cocaine|heroin|fentanyl|methamphetamine) (for sale|a vendre|livraison)\M'
     OR normalized ~ '\m(gun|firearm|arme a feu|pistolet) (for sale|a vendre|sans permis)\M'
     OR normalized ~ '\m(fake passport|stolen passport|faux passeport|passeport vole)\M' THEN
    RETURN 'illegal_goods';
  END IF;
  IF normalized ~ '\m(stolen credit card|stolen card|carte bancaire volee|carte volee)\M'
     OR normalized ~ '\m(buy|sell|acheter|vendre) (a |une? )?(verified )?(bank|paypal|stripe) account\M'
     OR normalized ~ '\m(guaranteed profit|profit garanti|double ton argent|double your money)\M' THEN
    RETURN 'fraud';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_moderated_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  column_name text;
  reason text;
  value text;
BEGIN
  FOREACH column_name IN ARRAY TG_ARGV LOOP
    value := to_jsonb(NEW) ->> column_name;
    reason := public.content_moderation_reason(value);
    IF reason IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'content_blocked:' || reason,
        DETAIL = 'column=' || column_name;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_moderated_text ON public.profiles;
    CREATE TRIGGER enforce_moderated_text BEFORE INSERT OR UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.enforce_moderated_text('display_name', 'handle', 'bio');
  END IF;
  IF to_regclass('public.lives') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_moderated_text ON public.lives;
    CREATE TRIGGER enforce_moderated_text BEFORE INSERT OR UPDATE ON public.lives
      FOR EACH ROW EXECUTE FUNCTION public.enforce_moderated_text('title', 'description');
  END IF;
  IF to_regclass('public.live_products') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_moderated_text ON public.live_products;
    CREATE TRIGGER enforce_moderated_text BEFORE INSERT OR UPDATE ON public.live_products
      FOR EACH ROW EXECUTE FUNCTION public.enforce_moderated_text('name', 'description', 'brand');
  END IF;
  IF to_regclass('public.shop_products') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_moderated_text ON public.shop_products;
    CREATE TRIGGER enforce_moderated_text BEFORE INSERT OR UPDATE ON public.shop_products
      FOR EACH ROW EXECUTE FUNCTION public.enforce_moderated_text('name', 'description', 'brand');
  END IF;
  IF to_regclass('public.vitrine_posts') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_moderated_text ON public.vitrine_posts;
    CREATE TRIGGER enforce_moderated_text BEFORE INSERT OR UPDATE ON public.vitrine_posts
      FOR EACH ROW EXECUTE FUNCTION public.enforce_moderated_text('caption');
  END IF;
  IF to_regclass('public.vitrine_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_moderated_text ON public.vitrine_comments;
    CREATE TRIGGER enforce_moderated_text BEFORE INSERT OR UPDATE ON public.vitrine_comments
      FOR EACH ROW EXECUTE FUNCTION public.enforce_moderated_text('body');
  END IF;
  IF to_regclass('public.dm_messages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_moderated_text ON public.dm_messages;
    CREATE TRIGGER enforce_moderated_text BEFORE INSERT OR UPDATE ON public.dm_messages
      FOR EACH ROW EXECUTE FUNCTION public.enforce_moderated_text('body');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.content_moderation_reason(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.content_moderation_reason(text) TO authenticated, service_role;

-- The payout status transition and balance refund succeed or roll back together.
CREATE OR REPLACE FUNCTION public.reject_payout_and_refund(
  _payout_id uuid,
  _seller_id uuid,
  _note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payout_row public.payouts%ROWTYPE;
  affected integer;
BEGIN
  UPDATE public.payouts
  SET status = 'rejected',
      processed_at = now(),
      admin_note = left(coalesce(_note, ''), 500)
  WHERE id = _payout_id
    AND seller_id = _seller_id
    AND status IN ('requested', 'processing')
    AND stripe_transfer_id IS NULL
  RETURNING * INTO payout_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_processed');
  END IF;
  IF payout_row.amount IS NULL OR payout_row.amount <= 0 THEN
    RAISE EXCEPTION 'invalid_payout_amount';
  END IF;

  CASE coalesce(payout_row.source, 'seller')
    WHEN 'wallet' THEN
      UPDATE public.wallets
      SET balance = coalesce(balance, 0) + payout_row.amount,
          updated_at = now()
      WHERE user_id = _seller_id;
    WHEN 'referral' THEN
      UPDATE public.referral_balances
      SET available = coalesce(available, 0) + payout_row.amount,
          updated_at = now()
      WHERE owner_id = _seller_id;
    ELSE
      UPDATE public.seller_balances
      SET available = coalesce(available, 0) + payout_row.amount,
          updated_at = now()
      WHERE seller_id = _seller_id;
  END CASE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'refund_balance_row_missing';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_payout_and_refund(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payout_and_refund(uuid, uuid, text) TO service_role;
