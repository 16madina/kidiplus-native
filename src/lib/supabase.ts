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

/** Columns allowed for authenticated clients — do not select `email`. */
export const PROFILE_SAFE_SELECT =
  "id, display_name, handle, avatar_url, bio, is_seller, country, phone, email_verified_at, created_at, language, currency, is_admin, terms_accepted_at, terms_version, age_confirmed_at, moderation_status, followers_count, following_count, rating_avg, rating_count, banner_url, is_verified, welcome_email_sent, is_referred, is_frozen, frozen_at";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  is_seller: boolean | null;
  country: string | null;
  phone: string | null;
  followers_count: number | null;
  following_count: number | null;
  is_admin: boolean | null;
};
