// Seller earnings + payouts (same tables/RPCs as kidiplus.com).

import { supabase } from "./supabase";

export type SellerBalance = {
  seller_id: string;
  available: number;
  /** Funds held in escrow — moves to `available` on delivery confirmation. */
  pending: number;
  currency: string;
  updated_at: string;
};

export type PayoutMethod = "wave" | "orange_money" | "bank_transfer" | "paypal" | "stripe_connect";
export type PayoutStatus = "requested" | "processing" | "paid" | "rejected";
export type PayoutSource = "seller" | "referral" | "wallet";

export type PayoutRow = {
  id: string;
  seller_id: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  destination: Record<string, string>;
  status: PayoutStatus;
  note: string | null;
  admin_note: string | null;
  requested_at: string;
  processed_at: string | null;
  source?: PayoutSource;
};

export async function fetchMyBalance(userId: string): Promise<SellerBalance | null> {
  const { data } = await supabase
    .from("seller_balances")
    .select("*")
    .eq("seller_id", userId)
    .maybeSingle();
  return (data ?? null) as SellerBalance | null;
}

export async function fetchMyPayouts(userId: string, limit = 50): Promise<PayoutRow[]> {
  const { data } = await supabase
    .from("payouts")
    .select("*")
    .eq("seller_id", userId)
    .order("requested_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PayoutRow[];
}

export type RequestPayoutResult =
  | { ok: true; payoutId: string }
  | { ok: false; error: string; min?: number; available?: number };

export async function requestPayout(
  amount: number,
  method: PayoutMethod,
  destination: Record<string, string>,
  source: PayoutSource = "seller",
): Promise<RequestPayoutResult> {
  const { data, error } = await supabase.rpc("request_payout", {
    _amount: amount,
    _method: method,
    _destination: destination,
    _source: source,
  } as never);
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok) return { ok: true, payoutId: String(r.payout_id) };
  return {
    ok: false,
    error: String(r.error ?? "request_failed"),
    ...(r.min != null ? { min: Number(r.min) } : {}),
    ...(r.available != null ? { available: Number(r.available) } : {}),
  };
}

const PAYPAL_PAYOUT_API = "https://kidiplus.com";

/** Admin-only: POST /api/paypal-payout (server requires profiles.is_admin).
 *  Seller withdrawals must NOT call this — anti-fraud review happens first. */
export async function dispatchPaypalPayout(payoutId: string): Promise<{
  ok: boolean;
  alreadySent?: boolean;
  error?: string;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "unauthorized" };
  try {
    const res = await fetch(`${PAYPAL_PAYOUT_API}/api/paypal-payout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Origin: "https://kidiplus.com",
      },
      body: JSON.stringify({ payoutId }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false) {
      return { ok: false, error: String(json.message ?? json.error ?? "paypal_payout_failed") };
    }
    return { ok: true, alreadySent: Boolean(json.alreadySent) };
  } catch {
    return { ok: false, error: "network" };
  }
}
