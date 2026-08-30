import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";

function looksLikeStripeSecret(value: string | undefined): value is string {
  if (!value) return false;
  const v = value.trim();
  return /^(sk|rk)_(live|test)_/.test(v);
}

/**
 * Prefer STRIPE_SECRET_KEY — STRIPE_LIVE_API_KEY on this project is revoked
 * (same stale live key as pk_live_…DBMx). Sandbox only when PAYMENTS_MODE says so.
 */
export function stripeSecret(): string {
  const mode = (Deno.env.get("PAYMENTS_MODE") ?? "live").toLowerCase();
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  const live = Deno.env.get("STRIPE_LIVE_API_KEY");
  const sandbox = Deno.env.get("STRIPE_SANDBOX_API_KEY");
  const order =
    mode === "sandbox" || mode === "test"
      ? [sandbox, secret, live]
      : [secret, live, sandbox];
  const picked = order.find(looksLikeStripeSecret);
  if (!picked) throw new Error("Aucune clé Stripe secrète valide (sk_live_ / sk_test_)");
  return picked.trim();
}

export function stripeClient(): Stripe {
  return new Stripe(stripeSecret(), {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}
