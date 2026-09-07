import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { accountLivemode, isStripeConfigError, stripeClient } from "../_shared/stripe.ts";
import { connectReadyPatch } from "../_shared/connect-profile.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("connect-webhook: STRIPE_WEBHOOK_SECRET is not configured");
    return json({ error: "webhook_not_configured" }, 503);
  }
  if (!signature) return json({ error: "missing_stripe_signature" }, 400);
  const raw = await req.text();
  try {
    const stripe = stripeClient();
    const event = stripe.webhooks.constructEvent(raw, signature, secret);
    if (event.type !== "account.updated") return json({ ok: true, ignored: true });

    const account = event.data.object as Stripe.Account;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = account.metadata?.kidi_user_id ?? account.metadata?.kidiplus_user_id;
    const patch = connectReadyPatch(account, accountLivemode(account));
    if (userId) {
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
    } else {
      const [{ error: accountError }, { error: connectError }] = await Promise.all([
        supabase.from("profiles").update(patch).eq("stripe_account_id", account.id),
        supabase.from("profiles").update(patch).eq("stripe_connect_id", account.id),
      ]);
      if (accountError) throw accountError;
      if (connectError) throw connectError;
    }
    return json({ ok: true });
  } catch (e) {
    if (isStripeConfigError(e)) {
      return json({ error: e.code, message: e.message }, 503);
    }
    console.error("connect-webhook", e);
    return json({ error: "server_error" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
