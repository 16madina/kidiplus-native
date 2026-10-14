-- profiles: a signed-in user may UPDATE their own row, and the grant covers every
-- column. That lets any account set is_admin, moderation_status, is_verified,
-- kyc_verified, is_frozen, the Stripe Connect flags, etc. on itself.
--
-- Direct client writes run as the `authenticated` (or `anon`) role. Server code
-- uses the service role and admin RPCs are SECURITY DEFINER, so for those
-- `current_user` is a different role and they keep full access.
--
-- The trigger silently restores the protected columns instead of raising, so
-- existing clients that send a whole profile object keep working.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;

  -- Roles, moderation, trust
  NEW.is_admin := OLD.is_admin;
  NEW.moderation_status := OLD.moderation_status;
  NEW.is_verified := OLD.is_verified;
  NEW.kyc_verified := OLD.kyc_verified;
  NEW.risk_restricted := OLD.risk_restricted;
  NEW.is_frozen := OLD.is_frozen;
  NEW.frozen_reason := OLD.frozen_reason;
  NEW.frozen_at := OLD.frozen_at;
  NEW.frozen_by := OLD.frozen_by;

  -- Counters and ratings (maintained by triggers / RPCs)
  NEW.followers_count := OLD.followers_count;
  NEW.following_count := OLD.following_count;
  NEW.rating_avg := OLD.rating_avg;
  NEW.rating_count := OLD.rating_count;

  -- Email verification (server routes only)
  NEW.email_verified_at := OLD.email_verified_at;
  NEW.email_confirm_code_hash := OLD.email_confirm_code_hash;
  NEW.email_confirm_expires_at := OLD.email_confirm_expires_at;
  NEW.email_confirm_sent_at := OLD.email_confirm_sent_at;

  -- Stripe Connect state (webhook / server routes only)
  NEW.stripe_connect_id := OLD.stripe_connect_id;
  NEW.stripe_account_id := OLD.stripe_account_id;
  NEW.stripe_business_type := OLD.stripe_business_type;
  NEW.stripe_payouts_enabled := OLD.stripe_payouts_enabled;
  NEW.stripe_requirements_due := OLD.stripe_requirements_due;
  NEW.connect_status := OLD.connect_status;
  NEW.connect_charges_enabled := OLD.connect_charges_enabled;
  NEW.connect_payouts_enabled := OLD.connect_payouts_enabled;
  NEW.connect_updated_at := OLD.connect_updated_at;

  -- Referral / onboarding bookkeeping
  NEW.is_referred := OLD.is_referred;
  NEW.welcome_email_sent := OLD.welcome_email_sent;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();
