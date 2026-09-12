-- Soft-rank lives by whether the seller ships to a country (feed).
-- Restore the delivery gate on place_live_bid (dropped by the sudden-death rewrite).
-- create_live_order already calls resolve_buyer_delivery — leave it.

CREATE OR REPLACE FUNCTION public.seller_delivers_to_country(_seller_id uuid, _country text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text := upper(trim(coalesce(_country, '')));
  v_seller_country text;
  v_delivery public.seller_delivery_settings;
  v_hit boolean;
BEGIN
  IF v_country = '' THEN
    RETURN true;
  END IF;

  SELECT country INTO v_seller_country FROM public.profiles WHERE id = _seller_id;
  v_seller_country := upper(trim(coalesce(v_seller_country, '')));

  SELECT * INTO v_delivery FROM public.seller_delivery_settings WHERE seller_id = _seller_id;

  IF v_delivery.seller_id IS NULL OR v_delivery.mode = 'flat' THEN
    RETURN true;
  END IF;

  IF v_delivery.mode = 'courier' THEN
    IF v_seller_country = '' THEN RETURN true; END IF;
    RETURN v_country = v_seller_country;
  END IF;

  IF jsonb_array_length(coalesce(v_delivery.zones, '[]'::jsonb)) = 0 THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(coalesce(v_delivery.zones, '[]'::jsonb)) z
     WHERE upper(coalesce(z->>'country', '')) = v_country
        OR (
          coalesce(z->>'country', '') = ''
          AND v_seller_country <> ''
          AND v_country = v_seller_country
        )
  ) INTO v_hit;

  RETURN coalesce(v_hit, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.sellers_deliver_to_country(_seller_ids uuid[], _country text)
RETURNS TABLE(seller_id uuid, delivers_to_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.seller_id, public.seller_delivers_to_country(s.seller_id, _country)
    FROM unnest(coalesce(_seller_ids, ARRAY[]::uuid[])) AS s(seller_id);
$$;

CREATE OR REPLACE FUNCTION public.list_lives_for_country(
  _country text,
  _status text DEFAULT 'live',
  _limit integer DEFAULT 60
)
RETURNS TABLE(id uuid, seller_id uuid, delivers_to_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ranked.id, ranked.seller_id, ranked.delivers_to_me
    FROM (
      SELECT
        l.id,
        l.seller_id,
        public.seller_delivers_to_country(l.seller_id, _country) AS delivers_to_me,
        l.started_at,
        l.scheduled_at
      FROM public.lives l
      WHERE l.status = _status
    ) ranked
   ORDER BY ranked.delivers_to_me DESC,
            CASE WHEN _status = 'scheduled' THEN ranked.scheduled_at END ASC NULLS LAST,
            ranked.started_at DESC NULLS LAST
   LIMIT greatest(1, least(coalesce(_limit, 60), 200));
$$;

REVOKE ALL ON FUNCTION public.seller_delivers_to_country(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.sellers_deliver_to_country(uuid[], text) FROM public;
REVOKE ALL ON FUNCTION public.list_lives_for_country(text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.seller_delivers_to_country(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sellers_deliver_to_country(uuid[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_lives_for_country(text, text, integer) TO anon, authenticated;

-- place_live_bid: sudden-death version + resolve_buyer_delivery (was lost).
CREATE OR REPLACE FUNCTION public.place_live_bid(
  _live_id uuid,
  _product_id uuid,
  _bidder_name text,
  _amount numeric DEFAULT NULL::numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_product public.live_products;
  v_live public.lives;
  v_last_bidder uuid;
  v_highest_amount numeric;
  v_current numeric; v_step numeric; v_min_next numeric; v_next numeric;
  v_bid_id uuid; v_currency text; v_cap numeric;
  v_round int;
  v_delivery jsonb;
  v_bidder_name text := coalesce(nullif(trim(coalesce(_bidder_name, '')), ''), 'invité');
  v_new_deadline timestamptz;
  v_extended boolean := false;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthorized'); END IF;
  PERFORM public.assert_user_active();
  SELECT * INTO v_product FROM public.live_products WHERE id = _product_id AND live_id = _live_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'product_not_found'); END IF;
  SELECT * INTO v_live FROM public.lives WHERE id = _live_id;
  IF NOT FOUND OR v_live.status <> 'live' THEN RETURN jsonb_build_object('ok', false, 'error', 'live_not_active'); END IF;
  IF v_product.mode <> 'auction' OR v_product.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auction_not_active'); END IF;
  IF v_product.auction_deadline_at IS NOT NULL AND v_product.auction_deadline_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auction_ended');
  END IF;

  v_delivery := public.resolve_buyer_delivery(v_live.seller_id, v_user);
  IF NOT coalesce((v_delivery->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_delivery->>'error', 'delivery_blocked'));
  END IF;

  v_round := COALESCE(v_product.auction_round, 1);
  SELECT bidder_id, amount INTO v_last_bidder, v_highest_amount
    FROM public.live_bids
   WHERE product_id = _product_id AND auction_round = v_round
   ORDER BY amount DESC, created_at DESC LIMIT 1;
  IF v_last_bidder = v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_highest',
      'current_price', greatest(v_product.price, coalesce(v_highest_amount, v_product.price)));
  END IF;
  v_current := greatest(v_product.price, coalesce(v_highest_amount, v_product.price));
  v_currency := upper(coalesce(v_live.currency, 'EUR'));
  v_step := CASE v_currency
    WHEN 'XOF' THEN CASE WHEN v_current < 5000 THEN 250 ELSE 500 END
    WHEN 'CAD' THEN 1
    WHEN 'USD' THEN CASE WHEN v_current < 10 THEN 0.5 ELSE 1 END
    WHEN 'GBP' THEN CASE WHEN v_current < 10 THEN 0.5 ELSE 1 END
    ELSE CASE WHEN v_current < 10 THEN 0.5 ELSE 1 END END;
  v_min_next := v_current + v_step;
  v_cap := greatest(coalesce(v_product.start_price, 0) * 100,
    CASE v_currency
      WHEN 'XOF' THEN 1000000
      WHEN 'CAD' THEN 3000
      WHEN 'USD' THEN 2200
      WHEN 'GBP' THEN 1800
      ELSE 2000 END);
  IF _amount IS NULL THEN v_next := v_min_next;
  ELSE
    v_next := _amount;
    IF v_currency = 'XOF' THEN v_next := round(v_next); ELSE v_next := round(v_next * 100) / 100; END IF;
    IF v_next < v_min_next THEN
      RETURN jsonb_build_object('ok', false, 'error', 'price_changed',
        'current_price', v_current, 'min_next', v_min_next);
    END IF;
    IF v_next > v_cap THEN
      RETURN jsonb_build_object('ok', false, 'error', 'above_cap', 'max_amount', v_cap);
    END IF;
  END IF;
  IF v_currency = 'XOF' THEN v_next := round(v_next); ELSE v_next := round(v_next * 100) / 100; END IF;

  INSERT INTO public.live_bids (live_id, product_id, bidder_id, bidder_name, amount, auction_round)
  VALUES (_live_id, _product_id, v_user, v_bidder_name, v_next, v_round) RETURNING id INTO v_bid_id;

  IF v_product.auction_deadline_at IS NOT NULL
     AND v_product.auction_deadline_at <= (now() + interval '10 seconds') THEN
    v_new_deadline := now() + interval '10 seconds';
    UPDATE public.live_products
       SET price = v_next,
           auction_deadline_at = v_new_deadline,
           current_bidder_id = v_user,
           current_bidder_name = v_bidder_name
     WHERE id = _product_id;
    v_extended := true;
  ELSE
    UPDATE public.live_products
       SET price = v_next,
           current_bidder_id = v_user,
           current_bidder_name = v_bidder_name
     WHERE id = _product_id;
    v_new_deadline := v_product.auction_deadline_at;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'bid_id', v_bid_id,
    'amount', v_next,
    'bidder_id', v_user,
    'bidder_name', v_bidder_name,
    'extended', v_extended,
    'deadline', v_new_deadline
  );
END;
$function$;
