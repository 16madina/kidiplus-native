/** Pick the Stripe secret for Connect. Never mix live and test. */

export type StripeSecretMode = "live" | "test";

export function looksLikeStripeSecret(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^(sk|rk)_(live|test)_/.test(value.trim());
}

export function stripeSecretIsLive(value: string): boolean {
  return /^(sk|rk)_live_/.test(value.trim());
}

export function paymentsModeFromEnv(raw: string | null | undefined): StripeSecretMode {
  const mode = (raw ?? "live").trim().toLowerCase();
  if (mode === "sandbox" || mode === "test") return "test";
  return "live";
}

export function pickStripeSecret(input: {
  paymentsMode?: string | null;
  secret?: string | null;
  live?: string | null;
  sandbox?: string | null;
}): { ok: true; secret: string; mode: StripeSecretMode } | { ok: false; error: string; mode: StripeSecretMode } {
  const mode = paymentsModeFromEnv(input.paymentsMode);
  const wantLive = mode === "live";
  const order = wantLive ? [input.secret, input.live] : [input.sandbox, input.secret];
  const picked = order.find((k) => looksLikeStripeSecret(k) && stripeSecretIsLive(k) === wantLive);
  if (!picked) {
    return {
      ok: false,
      mode,
      error: wantLive
        ? "Mode production : mets une clé sk_live_ dans STRIPE_SECRET_KEY (Supabase → Edge Functions → Secrets)."
        : "Mode test : aucune clé sk_test_ valide.",
    };
  }
  return { ok: true, secret: picked.trim(), mode };
}
