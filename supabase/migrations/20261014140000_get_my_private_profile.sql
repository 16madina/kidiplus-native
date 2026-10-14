-- Owner-only read of the private profile fields (contact, legal name, consent,
-- payout and Stripe Connect state). Clients use this instead of selecting those
-- columns on public.profiles, so the table can later expose only public fields.

CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'first_name', p.first_name,
    'last_name', p.last_name,
    'phone', p.phone,
    'email_verified_at', p.email_verified_at,
    'terms_accepted_at', p.terms_accepted_at,
    'terms_version', p.terms_version,
    'age_confirmed_at', p.age_confirmed_at,
    'welcome_email_sent', p.welcome_email_sent,
    'is_frozen', p.is_frozen,
    'frozen_at', p.frozen_at,
    'payout_paypal_email', p.payout_paypal_email,
    'payout_wave_phone', p.payout_wave_phone,
    'payout_om_phone', p.payout_om_phone,
    'payout_bank_iban', p.payout_bank_iban,
    'payout_bank_holder', p.payout_bank_holder,
    'stripe_account_id', p.stripe_account_id,
    'stripe_connect_id', p.stripe_connect_id,
    'connect_status', p.connect_status,
    'connect_charges_enabled', p.connect_charges_enabled,
    'connect_payouts_enabled', p.connect_payouts_enabled,
    'stripe_payouts_enabled', p.stripe_payouts_enabled
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_private_profile() FROM anon;
