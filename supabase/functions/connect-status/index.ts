import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_connect_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    const accountId =
      (typeof profile?.stripe_account_id === "string" && profile.stripe_account_id) ||
      (typeof profile?.stripe_connect_id === "string" && profile.stripe_connect_id) ||
      "";
    if (!accountId) {
      return json({
        ok: true,
        connected: false,
        charges_enabled: false,
        payouts_enabled: false,
        currently_due: [],
        status: "none",
      });
    }

    let account: Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(accountId);
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
      const stale =
        msg.includes("not connected to your platform") ||
        msg.includes("no such account") ||
        msg.includes("resource_missing") ||
        (msg.includes("account") && msg.includes("does not exist"));
      if (!stale) throw e;
      await supabase
        .from("profiles")
        .update({
          stripe_account_id: null,
          stripe_connect_id: null,
          stripe_payouts_enabled: false,
          stripe_requirements_due: null,
        })
        .eq("id", userData.user.id);
      return json({
        ok: true,
        connected: false,
        charges_enabled: false,
        payouts_enabled: false,
        currently_due: [],
        status: "none",
      });
    }
    const currentlyDue = account.requirements?.currently_due ?? [];
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const chargesEnabled = Boolean(account.charges_enabled);
    const status = payoutsEnabled
      ? "active"
      : currentlyDue.length || account.requirements?.disabled_reason
        ? "restricted"
        : "pending";

    await supabase
      .from("profiles")
      .update({
        stripe_payouts_enabled: payoutsEnabled,
        stripe_requirements_due: currentlyDue,
      })
      .eq("id", userData.user.id);

    return json({
      ok: true,
      connected: true,
      account_id: accountId,
      charges_enabled: chargesEnabled,
      chargesEnabled,
      payouts_enabled: payoutsEnabled,
      payoutsEnabled,
      detailsSubmitted: Boolean(account.details_submitted),
      currently_due: currentlyDue,
      status,
      country: account.country ?? "",
    });
  } catch (e) {
    console.error("connect-status", e);
    return json({ error: "server_error", message: String(e) }, 500);
  }
});

function cors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  return new Response(res.body, { status: res.status, headers });
}

function json(body: unknown, status = 200) {
  return cors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
