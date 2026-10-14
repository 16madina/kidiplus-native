import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/** Same KiDi+ project as kidiplus.com. Anon / publishable key only — never service_role. */
const FALLBACK_URL = "https://djwuvxpmvrwfjwjamjno.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd3V2eHBtdnJ3Zmp3amFtam5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTg4NTYsImV4cCI6MjEwMTkzNDg1Nn0.fCIOzg7Sp8K7UE_Tev-jkKjeUtLWYuvy4H_TERqEsG4";

function isNewApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || FALLBACK_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (isNewApiKey(SUPABASE_ANON_KEY) && headers.get("Authorization") === `Bearer ${SUPABASE_ANON_KEY}`) {
        headers.delete("Authorization");
      }
      headers.set("apikey", SUPABASE_ANON_KEY);
      return fetch(input, { ...init, headers });
    },
  },
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * Public profile columns: what any viewer may read about any account.
 * Private fields of the signed-in user come from `fetchMyPrivateProfile()`.
 */
export const PROFILE_PUBLIC_SELECT =
  "id, display_name, handle, avatar_url, bio, is_seller, country, created_at, language, currency, is_admin, moderation_status, followers_count, following_count, rating_avg, rating_count, banner_url, is_verified, is_referred";

/**
 * Legacy owner read (public + private columns on the table). Only used as a
 * fallback while the database does not have `get_my_private_profile()` yet.
 * Never select `email`.
 */
export const PROFILE_SAFE_SELECT =
  "id, display_name, handle, first_name, last_name, avatar_url, bio, is_seller, country, phone, email_verified_at, created_at, language, currency, is_admin, terms_accepted_at, terms_version, age_confirmed_at, moderation_status, followers_count, following_count, rating_avg, rating_count, banner_url, is_verified, welcome_email_sent, is_referred, is_frozen, frozen_at";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  handle: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  is_seller: boolean | null;
  country: string | null;
  phone: string | null;
  followers_count: number | null;
  following_count: number | null;
  is_admin: boolean | null;
  is_referred?: boolean | null;
  is_frozen?: boolean | null;
  frozen_at?: string | null;
  is_verified?: boolean | null;
};

/** Private fields of the signed-in user, returned by `get_my_private_profile()`. */
export type PrivateProfile = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email_verified_at: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  age_confirmed_at: string | null;
  welcome_email_sent: boolean | null;
  is_frozen: boolean | null;
  frozen_at: string | null;
  payout_paypal_email: string | null;
  payout_wave_phone: string | null;
  payout_om_phone: string | null;
  payout_bank_iban: string | null;
  payout_bank_holder: string | null;
  stripe_account_id: string | null;
  stripe_connect_id: string | null;
  connect_status: string | null;
  connect_charges_enabled: boolean | null;
  connect_payouts_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
};

/**
 * Owner-only private fields. `unavailable` means the RPC is not deployed (or
 * failed): callers then fall back to reading the columns on `profiles`.
 */
export async function fetchMyPrivateProfile(): Promise<
  { ok: true; data: PrivateProfile | null } | { ok: false }
> {
  const { data, error } = await supabase.rpc("get_my_private_profile");
  if (error) return { ok: false };
  return { ok: true, data: (data as PrivateProfile | null) ?? null };
}
