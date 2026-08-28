/**
 * Same Stripe helpers as kidiplus.com `stripe-connect-client`:
 * default live publishable key + X-Payments-Env derived from pk_live_ vs pk_test_.
 */
export const KIDI_STRIPE_PUBLISHABLE_KEY =
  "pk_live_51SYGiOPn7aesiMlZlR6MO5jGJDscqNNxKqAPAQLWONp833J5VCZCKOMFJDUPipmaHLhDumicjmKemyk9hBRBXpAC00zcJfOrQY";

export function normalizePublishableKey(value?: string | null): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.startsWith("pk_")) return trimmed;
  return KIDI_STRIPE_PUBLISHABLE_KEY;
}

export function paymentsEnvHeaders(key?: string | null): { "X-Payments-Env": "live" | "sandbox" } {
  const pk = normalizePublishableKey(key);
  return { "X-Payments-Env": pk.startsWith("pk_live_") ? "live" : "sandbox" };
}
