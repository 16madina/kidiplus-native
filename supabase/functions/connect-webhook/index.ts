import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { accountLivemode, isStripeConfigError, stripeClient } from "../_shared/stripe.ts";
import { connectReadyPatch } from "../_shared/connect-profile.ts";

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const raw = await req.text();
  try {
    const stripe = stripeClient();
    const event = secret && signature
      ? stripe.webhooks.constructEvent(raw, signature, secret)
      : (JSON.parse(raw) as Stripe.Event);
    if (event.type !== "account.updated") return json({ ok: true, ignored: true });

    const account = event.data.object as Stripe.Account;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = account.metadata?.kidi_user_id ?? account.metadata?.kidiplus_user_id;
    const patch = connectReadyPatch(account, accountLivemode(account));
    if (userId) {
      await supabase.from("profiles").update(patch).eq("id", userId);
    } else {
      await supabase.from("profiles").update(patch).eq("stripe_account_id", account.id);
      await supabase.from("profiles").update(patch).eq("stripe_connect_id", account.id);
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
