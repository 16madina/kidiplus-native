// Map kidiplus.com payment API error codes → i18n keys / fallbacks.

import type { TFunction } from "i18next";

const CODE_TO_KEY: Record<string, string> = {
  network: "pay.errors.network",
  not_signed_in: "pay.errors.notSignedIn",
  unauthorized: "pay.errors.notSignedIn",
  stripe_not_configured: "pay.errors.notConfigured",
  paypal_not_configured: "pay.errors.notConfigured",
  backend_not_configured: "pay.errors.notConfigured",
  card_declined: "pay.errors.cardDeclined",
  currency_not_supported: "pay.errors.currencyNotSupported",
  invalid_amount: "pay.errors.invalidAmount",
  rate_limited: "pay.errors.rateLimited",
  daily_limit: "pay.errors.rateLimited",
  conversion_unavailable: "pay.errors.conversionUnavailable",
  order_not_pending: "pay.errors.orderNotPending",
  order_already_paid: "pay.errors.orderNotPending",
  already_paid: "pay.errors.orderNotPending",
  order_expired: "pay.errors.orderExpired",
  order_not_found: "pay.errors.orderNotFound",
  forbidden: "pay.errors.forbidden",
  account_banned: "risk.errors.banned",
  account_suspended: "risk.errors.suspended",
  risk_restricted: "risk.errors.restricted",
  paypal_create_failed: "pay.errors.generic",
  paypal_oauth_failed: "pay.errors.generic",
  paypal_cancelled: "wallet.topup.paypalCancelled",
};

export function mapPayError(
  code: string | null | undefined,
  t: TFunction,
  fallbackMessage?: string | null,
): string {
  const c = String(code ?? "").trim();
  if (!c) return t("pay.errors.generic");
  const key = CODE_TO_KEY[c];
  if (key) return t(key, { defaultValue: fallbackMessage || undefined });
  if (fallbackMessage) return fallbackMessage;
  // Prefer a readable code over a blank "network" lie.
  if (c.startsWith("http_")) return t("pay.errors.network");
  return t("pay.errors.generic");
}

export const PAYPAL_REDIRECT_SCHEME = "kidiplus://paypal-done";

export function parsePaypalDoneUrl(url: string): {
  status: string;
  kind: "topup" | "order";
  amount: string | null;
  currency: string | null;
  orderId: string | null;
} {
  try {
    const u = new URL(url);
    const status = u.searchParams.get("status") ?? "error";
    const kind = u.searchParams.get("kind") === "order" ? "order" : "topup";
    return {
      status,
      kind,
      amount: u.searchParams.get("amount"),
      currency: u.searchParams.get("currency"),
      orderId: u.searchParams.get("orderId"),
    };
  } catch {
    return { status: "error", kind: "topup", amount: null, currency: null, orderId: null };
  }
}
