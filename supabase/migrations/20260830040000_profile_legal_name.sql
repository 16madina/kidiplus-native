-- Legal identity for Stripe Connect (never the shop display name / handle).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.profiles.first_name IS 'Legal first name (ID) — used for Stripe Express, not the shop name';
COMMENT ON COLUMN public.profiles.last_name IS 'Legal last name (ID) — used for Stripe Express, not the shop name';

GRANT UPDATE (first_name, last_name) ON public.profiles TO authenticated;
