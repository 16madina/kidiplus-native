-- Seller payout destinations on profiles (same table as stripe_connect_id).
-- Paste in the Supabase SQL editor if this repo is not linked to `supabase db push`.
--
-- These columns must NOT leak via public profile reads (shops / vitrine).
-- SELECT is revoked on the payout columns; owners read/write via RPCs below.
-- Admins read via admin_get_payout_methods.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_paypal_email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_wave_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_om_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_bank_iban text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_bank_holder text;

COMMENT ON COLUMN public.profiles.payout_paypal_email IS 'Seller PayPal payout email';
COMMENT ON COLUMN public.profiles.payout_wave_phone IS 'Seller Wave payout phone (E.164)';
COMMENT ON COLUMN public.profiles.payout_om_phone IS 'Seller Orange Money payout phone (E.164)';
COMMENT ON COLUMN public.profiles.payout_bank_iban IS 'Seller manual bank payout IBAN';
COMMENT ON COLUMN public.profiles.payout_bank_holder IS 'Seller manual bank payout account holder';

REVOKE SELECT (
  payout_paypal_email,
  payout_wave_phone,
  payout_om_phone,
  payout_bank_iban,
  payout_bank_holder
) ON public.profiles FROM PUBLIC, anon, authenticated;

GRANT UPDATE (
  payout_paypal_email,
  payout_wave_phone,
  payout_om_phone,
  payout_bank_iban,
  payout_bank_holder
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_payout_methods()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  SELECT * INTO r FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'payout_paypal_email', r.payout_paypal_email,
    'payout_wave_phone', r.payout_wave_phone,
    'payout_om_phone', r.payout_om_phone,
    'payout_bank_iban', r.payout_bank_iban,
    'payout_bank_holder', r.payout_bank_holder
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_payout_methods(_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_patch');
  END IF;

  UPDATE public.profiles SET
    payout_paypal_email = CASE
      WHEN _patch ? 'payout_paypal_email' THEN nullif(btrim(_patch->>'payout_paypal_email'), '')
      ELSE payout_paypal_email
    END,
    payout_wave_phone = CASE
      WHEN _patch ? 'payout_wave_phone' THEN nullif(btrim(_patch->>'payout_wave_phone'), '')
      ELSE payout_wave_phone
    END,
    payout_om_phone = CASE
      WHEN _patch ? 'payout_om_phone' THEN nullif(btrim(_patch->>'payout_om_phone'), '')
      ELSE payout_om_phone
    END,
    payout_bank_iban = CASE
      WHEN _patch ? 'payout_bank_iban' THEN nullif(upper(replace(btrim(_patch->>'payout_bank_iban'), ' ', '')), '')
      ELSE payout_bank_iban
    END,
    payout_bank_holder = CASE
      WHEN _patch ? 'payout_bank_holder' THEN nullif(btrim(_patch->>'payout_bank_holder'), '')
      ELSE payout_bank_holder
    END
  WHERE id = auth.uid()
  RETURNING * INTO r;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_paypal_email', r.payout_paypal_email,
    'payout_wave_phone', r.payout_wave_phone,
    'payout_om_phone', r.payout_om_phone,
    'payout_bank_iban', r.payout_bank_iban,
    'payout_bank_holder', r.payout_bank_holder
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_payout_methods(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.profiles;
BEGIN
  PERFORM public._assert_admin();
  SELECT * INTO r FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'user_id', r.id,
    'payout_paypal_email', r.payout_paypal_email,
    'payout_wave_phone', r.payout_wave_phone,
    'payout_om_phone', r.payout_om_phone,
    'payout_bank_iban', r.payout_bank_iban,
    'payout_bank_holder', r.payout_bank_holder
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_payout_methods() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_payout_methods() TO authenticated;

REVOKE ALL ON FUNCTION public.update_my_payout_methods(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_payout_methods(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_get_payout_methods(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_payout_methods(uuid) TO authenticated;
