// Buyer payments — same Supabase RPCs + kidiplus.com HTTP APIs as the web app.

import { supabase } from "./supabase";
import { normalizeCurrency, type Currency } from "./money";

const API_BASE = "https://kidiplus.com";

async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function api<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const token = await bearer();
  if (!token) return { ok: false, error: "not_signed_in" };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false || json.error) {
      return { ok: false, error: String(json.error ?? `http_${res.status}`) };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "network" };
  }
}

// ---------------------------------------------------------------------------
// Wallet pay (pure RPC — debits orders.total, credits seller escrow)
// ---------------------------------------------------------------------------

export type WalletPayResult =
  | { ok: true; balance: number }
  | { ok: false; error: string; balance?: number; total?: number };

export async function payOrderWithWallet(orderId: string): Promise<WalletPayResult> {
  const { data, error } = await supabase.rpc("pay_order_with_wallet", {
    _order_id: orderId,
  } as never);
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok) return { ok: true, balance: Number(r.balance ?? 0) };
  return {
    ok: false,
    error: String(r.error ?? "generic"),
    ...(r.balance != null ? { balance: Number(r.balance) } : {}),
    ...(r.total != null ? { total: Number(r.total) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Card (Stripe PaymentIntent via kidiplus.com)
// ---------------------------------------------------------------------------

export type CheckoutIntent = {
  clientSecret: string;
  publishableKey: string;
  orderId: string;
  total: number;
  currency: string;
};

export async function createOrderCheckout(orderId: string) {
  return api<CheckoutIntent>("/api/checkout", { orderId });
}

export async function confirmOrderCheckout(paymentIntentId: string) {
  return api<{ ok: true; orderId: string; status: string }>("/api/checkout/confirm", {
    paymentIntentId,
  });
}

export type TopupIntent = {
  clientSecret: string;
  publishableKey: string;
  amount: number;
  currency: string;
};

export async function createWalletTopup(amount: number) {
  return api<TopupIntent>("/api/wallet-topup", { amount });
}

export async function confirmWalletTopup(paymentIntentId: string) {
  return api<{ ok: true }>("/api/wallet-topup/confirm", { paymentIntentId });
}

// ---------------------------------------------------------------------------
// PayPal (approve URL in browser + capture on return)
// ---------------------------------------------------------------------------

export type PaypalCreate = {
  ok: true;
  paypalOrderId?: string;
  orderId?: string;
  approveUrl: string;
};

export async function createPaypalOrderCheckout(orderId: string) {
  return api<PaypalCreate>("/api/paypal-checkout/create", { orderId, native: true });
}

export async function capturePaypalOrder(paypalOrderId: string) {
  return api<{ ok: true; orderId: string; captureId: string }>("/api/paypal-checkout/capture", {
    paypalOrderId,
  });
}

export async function createPaypalTopup(amount: number) {
  return api<PaypalCreate>("/api/paypal-topup/create", { amount, native: true });
}

export async function capturePaypalTopup(paypalOrderId: string) {
  return api<{ ok: true; balance: number; amount: number }>("/api/paypal-topup/capture", {
    orderId: paypalOrderId,
  });
}

// ---------------------------------------------------------------------------
// Top-up limits (mirrors kidiplus.com topUpLimits)
// ---------------------------------------------------------------------------

export function topUpLimits(currency: string | null | undefined): { min: number; max: number } {
  const c: Currency = normalizeCurrency(currency);
  if (c === "XOF") return { min: 1000, max: 300_000 };
  return { min: 2, max: 500 };
}
