import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isStripeConfigError, stripeClient } from "../_shared/stripe.ts";
import { connectClearPatch, connectReadyPatch, connectStatusFromAccount } from "../_shared/connect-profile.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  try {
    const stripe = stripeClient();
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
        livemode: null,
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
        msg.includes("does not have access to account") ||
        (msg.includes("account") && msg.includes("does not exist"));
      if (!stale) throw e;
      await supabase.from("profiles").update(connectClearPatch()).eq("id", userData.user.id);
      return json({
        ok: true,
        connected: false,
        charges_enabled: false,
        payouts_enabled: false,
        currently_due: [],
        status: "none",
        livemode: null,
      });
    }

    const currentlyDue = account.requirements?.currently_due ?? [];
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const chargesEnabled = Boolean(account.charges_enabled);
    const livemode = account.livemode === true;
    const status = connectStatusFromAccount(account);

    await supabase.from("profiles").update(connectReadyPatch(account)).eq("id", userData.user.id);

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
      livemode,
      country: account.country ?? "",
    });
  } catch (e) {
    if (isStripeConfigError(e)) {
      return json({ error: e.code, message: e.message }, 503);
    }
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
