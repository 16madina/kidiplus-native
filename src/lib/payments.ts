// Buyer payments — same Supabase RPCs + kidiplus.com HTTP APIs as the web app.

import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";
import { normalizeCurrency, type Currency } from "./money";
import { PAYPAL_REDIRECT_SCHEME, parsePaypalDoneUrl } from "./pay-errors";

const API_BASE = "https://kidiplus.com";

WebBrowser.maybeCompleteAuthSession();

async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export type ApiFail = { ok: false; error: string; message?: string };

async function api<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | ApiFail> {
  const token = await bearer();
  if (!token) return { ok: false, error: "not_signed_in" };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // RN sometimes omits Origin; kidiplus.com CORS allows this host.
        Origin: "https://kidiplus.com",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok === false || (json.error && !json.clientSecret)) {
      return {
        ok: false,
        error: String(json.error ?? `http_${res.status}`),
        ...(typeof json.message === "string" ? { message: json.message } : {}),
        ...(typeof json.detail === "string" ? { message: String(json.detail) } : {}),
      };
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
// PayPal (ASWebAuthenticationSession → kidiplus://paypal-done)
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

export type PaypalBrowserResult =
  | { ok: true; status: "ok" | "pending"; amount: string | null; currency: string | null; orderId: string | null }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

/**
 * Opens PayPal approve URL in a system auth session that auto-closes when the
 * server bounces to `kidiplus://paypal-done` — no "Open in KiDi+?" prompt.
 * Server already finalizes capture on the return URL when native=1.
 * Ephemeral session avoids reusing the merchant PayPal login from Safari.
 */
export async function openPaypalCheckout(approveUrl: string): Promise<PaypalBrowserResult> {
  try {
    const result = await WebBrowser.openAuthSessionAsync(approveUrl, PAYPAL_REDIRECT_SCHEME, {
      // Critical: don't reuse Safari cookies where the KiDi+ merchant is logged in.
      preferEphemeralSession: true,
      showInRecents: false,
    });
    if (result.type === "success" && "url" in result && result.url) {
      const parsed = parsePaypalDoneUrl(result.url);
      if (parsed.status === "cancelled") return { ok: false, cancelled: true };
      if (parsed.status === "ok" || parsed.status === "pending") {
        return {
          ok: true,
          status: parsed.status === "ok" ? "ok" : "pending",
          amount: parsed.amount,
          currency: parsed.currency,
          orderId: parsed.orderId,
        };
      }
      return { ok: false, cancelled: false, error: parsed.status || "paypal_failed" };
    }
    // User closed the sheet (Done) without completing — treat as cancel.
    if (result.type === "cancel" || result.type === "dismiss") {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: true };
  } catch {
    return { ok: false, cancelled: false, error: "network" };
  }
}

// ---------------------------------------------------------------------------
// Top-up limits (mirrors kidiplus.com topUpLimits)
// ---------------------------------------------------------------------------

export function topUpLimits(currency: string | null | undefined): { min: number; max: number } {
  const c: Currency = normalizeCurrency(currency);
  if (c === "XOF") return { min: 1000, max: 300_000 };
  return { min: 2, max: 500 };
}
