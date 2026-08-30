import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";

function looksLikeStripeSecret(value: string | undefined): value is string {
  if (!value) return false;
  return /^(sk|rk)_(live|test)_/.test(value.trim());
}

function isLiveSecret(value: string): boolean {
  return /^(sk|rk)_live_/.test(value.trim());
}

export class StripeConfigError extends Error {
  readonly code = "connect_live_key_missing";
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigError";
  }
}

/**
 * Production (default): only sk_live_ / rk_live_. Never fall back to sk_test_.
 * Test/sandbox: only when PAYMENTS_MODE is test or sandbox.
 */
export function stripeSecret(): string {
  const mode = (Deno.env.get("PAYMENTS_MODE") ?? "live").toLowerCase();
  const wantLive = mode !== "sandbox" && mode !== "test";
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  const live = Deno.env.get("STRIPE_LIVE_API_KEY");
  const sandbox = Deno.env.get("STRIPE_SANDBOX_API_KEY");
  const order = wantLive ? [secret, live] : [sandbox, secret];
  const picked = order.find((k) => looksLikeStripeSecret(k) && isLiveSecret(k) === wantLive);
  if (!picked) {
    throw new StripeConfigError(
      wantLive
        ? "Mode production : mets une clé sk_live_ dans STRIPE_SECRET_KEY (Supabase → Edge Functions → Secrets)."
        : "Mode test : aucune clé sk_test_ valide.",
    );
  }
  return picked.trim();
}

export function stripeClient(): Stripe {
  return new Stripe(stripeSecret(), {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * v1 Account often omits `livemode`. A retrieve with sk_live_ only
 * succeeds for a live connected account — treat that as live.
 */
export function accountLivemode(account: { livemode?: boolean | null }): boolean {
  if (account.livemode === true) return true;
  if (account.livemode === false) return false;
  return isLiveSecret(stripeSecret());
}

export function isStripeConfigError(e: unknown): e is StripeConfigError {
  return e instanceof StripeConfigError || (e instanceof Error && e.name === "StripeConfigError");
}
