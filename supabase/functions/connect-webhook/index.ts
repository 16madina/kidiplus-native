import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const raw = await req.text();
  try {
    const event = secret && signature
      ? stripe.webhooks.constructEvent(raw, signature, secret)
      : (JSON.parse(raw) as Stripe.Event);
    if (event.type !== "account.updated") return json({ ok: true, ignored: true });

    const account = event.data.object as Stripe.Account;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = account.metadata?.kidi_user_id;
    const patch = {
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
      stripe_requirements_due: account.requirements?.currently_due ?? [],
    };
    if (userId) {
      await supabase.from("profiles").update(patch).eq("id", userId);
    } else {
      await supabase.from("profiles").update(patch).eq("stripe_account_id", account.id);
      await supabase.from("profiles").update(patch).eq("stripe_connect_id", account.id);
    }
    return json({ ok: true });
  } catch (e) {
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
