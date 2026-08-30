-- Stripe Connect seller columns (onboarding + webhook status).
-- Paste in the Supabase SQL editor if this repo is not linked to `supabase db push`.
-- Deploy Edge Functions: connect-onboard, connect-status, connect-dashboard-link, connect-webhook.
-- Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (webhook only).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_connect_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_business_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_requirements_due jsonb;
-- Already on kidiplus.com — request_payout reads connect_status, not stripe_payouts_enabled.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS connect_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS connect_charges_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS connect_payouts_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS connect_updated_at timestamptz;

COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect Express account id (acct_...)';
COMMENT ON COLUMN public.profiles.stripe_business_type IS 'individual | company — set once at onboarding';
COMMENT ON COLUMN public.profiles.stripe_payouts_enabled IS 'Cached from Stripe account.payouts_enabled';
COMMENT ON COLUMN public.profiles.stripe_requirements_due IS 'Cached Stripe requirements.currently_due';
