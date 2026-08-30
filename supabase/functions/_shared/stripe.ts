import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";

/** Live vs sandbox — same env names as kidiplus.com payments. */
export function stripeClient(): Stripe {
  const mode = (Deno.env.get("PAYMENTS_MODE") ?? "live").toLowerCase();
  const secret =
    mode === "sandbox" || mode === "test"
      ? Deno.env.get("STRIPE_SANDBOX_API_KEY") || Deno.env.get("STRIPE_SECRET_KEY")
      : Deno.env.get("STRIPE_LIVE_API_KEY") || Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("STRIPE_LIVE_API_KEY / STRIPE_SECRET_KEY manquante");
  return new Stripe(secret, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}
