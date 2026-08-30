// Login link vers le tableau de bord Stripe Express.
// Le vendeur peut y corriger ce qui a été prérempli (URL boutique, poste, etc.).

import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isStripeConfigError, stripeClient } from "../_shared/stripe.ts";

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
      return json({ error: "not_connected", message: "Aucun compte Stripe à gérer." }, 400);
    }

    const link = await stripe.accounts.createLoginLink(accountId);
    return json({ ok: true, url: link.url });
  } catch (e) {
    if (isStripeConfigError(e)) {
      return json({ error: e.code, message: e.message }, 503);
    }
    console.error("connect-dashboard-link", e);
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
