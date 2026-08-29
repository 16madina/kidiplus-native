// Buyer payments — same Supabase RPCs + kidiplus.com HTTP APIs as the web app.

import { AppState, Linking } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { supabase } from "./supabase";
import { PAYPAL_REDIRECT_SCHEME, parsePaypalDoneUrl } from "./pay-errors";
import { normalizePublishableKey, paymentsEnvHeaders } from "./stripe-web";

const API_BASE = "https://kidiplus.com";

type WebBrowserModule = typeof import("expo-web-browser");

let webBrowserCached: WebBrowserModule | null | undefined;

/**
 * Never `require("expo-web-browser")` unless the native binary has ExpoWebBrowser.
 * A plain try/catch around require still redboxes: Metro treats the missing
 * native module as fatal during module evaluation.
 */
function loadWebBrowser(): WebBrowserModule | null {
  if (webBrowserCached !== undefined) return webBrowserCached;
  if (!requireOptionalNativeModule("ExpoWebBrowser")) {
    webBrowserCached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    webBrowserCached = require("expo-web-browser") as WebBrowserModule;
    try {
      webBrowserCached.maybeCompleteAuthSession();
    } catch {
      /* ignore */
    }
  } catch {
    webBrowserCached = null;
  }
  return webBrowserCached;
}

async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export type ApiFail = { ok: false; error: string; message?: string };

function isStripePath(path: string): boolean {
  return (
    path.startsWith("/api/wallet-topup") ||
    path.startsWith("/api/checkout") ||
    path.startsWith("/api/connect") ||
    path.includes("wallet-topup") ||
    path.includes("/checkout")
  );
}

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
        Origin: "https://kidiplus.com",
        ...(isStripePath(path) ? paymentsEnvHeaders() : {}),
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const hasStripeSecret = typeof json.clientSecret === "string" && json.clientSecret.length > 0;
    const hasPaypalUrl = typeof json.approveUrl === "string" && json.approveUrl.length > 0;
    if (!res.ok || json.ok === false || (json.error && !hasStripeSecret && !hasPaypalUrl)) {
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

function withPublishableKey<T extends { publishableKey?: string }>(data: T): T {
  return { ...data, publishableKey: normalizePublishableKey(data.publishableKey) };
}

export async function createOrderCheckout(orderId: string) {
  const res = await api<CheckoutIntent>("/api/checkout", { orderId });
  if (!res.ok) return res;
  return { ok: true as const, data: withPublishableKey(res.data) };
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
  const res = await api<TopupIntent>("/api/wallet-topup", { amount });
  if (!res.ok) return res;
  return { ok: true as const, data: withPublishableKey(res.data) };
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

function resultFromPaypalUrl(url: string): PaypalBrowserResult {
  const parsed = parsePaypalDoneUrl(url);
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

/** Fallback when expo-web-browser isn't in the native binary yet. */
async function openPaypalViaLinking(approveUrl: string): Promise<PaypalBrowserResult> {
  return await new Promise<PaypalBrowserResult>((resolve) => {
    let settled = false;
    const finish = (result: PaypalBrowserResult) => {
      if (settled) return;
      settled = true;
      linkSub.remove();
      appSub.remove();
      resolve(result);
    };

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      if (url.includes("paypal-done") || url.startsWith("kidiplus://")) {
        finish(resultFromPaypalUrl(url));
      }
    });

    const appSub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      // User came back without a deep link (closed Safari / cancelled).
      // Refresh as pending — server may already have credited on success.
      setTimeout(() => {
        finish({ ok: true, status: "pending", amount: null, currency: null, orderId: null });
      }, 400);
    });

    void Linking.openURL(approveUrl).catch(() => {
      finish({ ok: false, cancelled: false, error: "network" });
    });
  });
}

/** True when ASWebAuthenticationSession (ephemeral) is available in this binary. */
export function paypalAuthSessionAvailable(): boolean {
  return loadWebBrowser() !== null;
}

/**
 * Opens PayPal approve URL in a system auth session that auto-closes when the
 * server bounces to `kidiplus://paypal-done` — no "Open in KiDi+?" prompt.
 * Falls back to Safari Linking when expo-web-browser isn't linked yet.
 *
 * preferEphemeralSession avoids reusing the merchant PayPal cookies from Safari
 * (which causes "ce compte est associé au marchand").
 */
export async function openPaypalCheckout(approveUrl: string): Promise<PaypalBrowserResult> {
  const WebBrowser = loadWebBrowser();
  if (WebBrowser) {
    try {
      const result = await WebBrowser.openAuthSessionAsync(approveUrl, PAYPAL_REDIRECT_SCHEME, {
        preferEphemeralSession: true,
        showInRecents: false,
      });
      if (result.type === "success" && "url" in result && result.url) {
        return resultFromPaypalUrl(result.url);
      }
      if (result.type === "cancel" || result.type === "dismiss") {
        return { ok: false, cancelled: true };
      }
      return { ok: false, cancelled: true };
    } catch {
      /* fall through to Linking */
    }
  }
  return openPaypalViaLinking(approveUrl);
}

export { topUpLimits } from "./topup-logic";
