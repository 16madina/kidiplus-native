// Certification (verified account) helpers — same RPCs as kidiplus.com.

import { supabase } from "./supabase";

export type Eligibility = {
  exists: boolean;
  is_seller: boolean;
  sales_count: number;
  sales_ok: boolean;
  rating_avg: number;
  review_count: number;
  rating_ok: boolean;
  age_days: number;
  age_ok: boolean;
  no_sanction: boolean;
  all_ok: boolean;
};

export async function fetchEligibility(userId: string): Promise<Eligibility | null> {
  const { data, error } = await supabase.rpc("verification_eligibility", { _user: userId } as never);
  if (error) return null;
  return data as unknown as Eligibility;
}

export type VerificationRequestRow = {
  id: string;
  user_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  created_at: string;
};

export async function fetchMyLatestVerification(userId: string): Promise<VerificationRequestRow | null> {
  const { data, error } = await supabase
    .from("verification_requests")
    .select("id, user_id, message, status, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return (data?.[0] as VerificationRequestRow | undefined) ?? null;
}

export async function submitVerificationRequest(
  message?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("request_verification", {
    _message: message?.trim() || undefined,
  } as never);
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as { ok: boolean; error?: string };
}

export async function fetchIsVerified(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_verified")
    .eq("id", userId)
    .maybeSingle();
  return !!(data as { is_verified?: boolean } | null)?.is_verified;
}
