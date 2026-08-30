// Admin-only live Stripe treasury: platform balance, seller IOU,
// leftover commission, and a bank payout of commission only.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isStripeConfigError, stripeClient } from "../_shared/stripe.ts";
import {
  amountOf,
  buildTreasurySnapshot,
  capPlatformPayout,
  moneyFromStripeBalances,
  platformPayoutMinimum,
  toStripeMinor,
  type MoneyByCur,
} from "../_shared/treasury.ts";

const CONNECT_CURRENCIES = new Set(["EUR", "CAD", "USD", "GBP"]);

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
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.is_admin) return json({ error: "forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action.trim() : "balance";

    const stripe = stripeClient();
    const snapshot = await loadSnapshot(supabase, stripe);

    if (action !== "payout") {
      return json({ ok: true, ...snapshot });
    }

    const currency = String(body.currency ?? "").toUpperCase();
    if (!CONNECT_CURRENCIES.has(currency)) {
      return json({ error: "currency_unsupported", currency }, 400);
    }

    const payoutable = amountOf(snapshot.payoutable, currency);
    const available = amountOf(snapshot.stripeAvailable, currency);
    const requested =
      typeof body.amount === "number" && Number.isFinite(body.amount) ? body.amount : payoutable;
    const send = capPlatformPayout(requested, payoutable, available);
    const min = platformPayoutMinimum(currency);
    if (send < min) {
      return json({ error: "nothing_to_payout", payoutable, min }, 400);
    }

    try {
      const payout = await stripe.payouts.create({
        amount: toStripeMinor(send, currency),
        currency: currency.toLowerCase(),
        statement_descriptor: "KIDI+",
        description: "Commissions KiDi+",
      });
      const next = await loadSnapshot(supabase, stripe);
      return json({
        ok: true,
        paid: send,
        currency,
        payoutId: payout.id,
        ...next,
      });
    } catch (e) {
      return json(mapPayoutError(e), 400);
    }
  } catch (e) {
    if (isStripeConfigError(e)) return json({ error: "stripe_config" }, 500);
    const message = e instanceof Error ? e.message : "server_error";
    return json({ error: "server_error", message }, 500);
  }
});

async function loadSnapshot(
  supabase: SupabaseClient,
  stripe: ReturnType<typeof stripeClient>,
) {
  const [bal, sellers, wallets, inflight] = await Promise.all([
    stripe.balance.retrieve(),
    supabase.from("seller_balances").select("available, pending, currency"),
    supabase.from("wallets").select("balance, currency"),
    supabase
      .from("payouts")
      .select("amount, currency, status")
      .in("status", ["requested", "processing"]),
  ]);

  const stripeAvailable = moneyFromStripeBalances(bal.available);
  const stripePending = moneyFromStripeBalances(bal.pending);
  const owedSellers = sumOwed(sellers.data, inflight.data);
  const walletFloat = sumWallets(wallets.data);
  const computed = buildTreasurySnapshot({
    stripeAvailable,
    stripePending,
    owedSellers,
    walletFloat,
  });

  return {
    livemode: bal.livemode === true,
    generatedAt: new Date().toISOString(),
    stripeAvailable,
    stripePending,
    stripeTotal: computed.stripeTotal,
    owedSellers,
    walletFloat,
    commission: computed.commission,
    payoutable: computed.payoutable,
  };
}

function sumOwed(
  sellers: Array<{ available?: number; pending?: number; currency?: string }> | null,
  inflight: Array<{ amount?: number; currency?: string }> | null,
): MoneyByCur {
  const out: MoneyByCur = {};
  for (const row of sellers ?? []) {
    const cur = String(row.currency ?? "").toUpperCase();
    if (!cur) continue;
    out[cur] = (out[cur] ?? 0) + Number(row.available ?? 0) + Number(row.pending ?? 0);
  }
  for (const row of inflight ?? []) {
    const cur = String(row.currency ?? "").toUpperCase();
    if (!cur) continue;
    out[cur] = (out[cur] ?? 0) + Number(row.amount ?? 0);
  }
  return out;
}

function sumWallets(rows: Array<{ balance?: number; currency?: string }> | null): MoneyByCur {
  const out: MoneyByCur = {};
  for (const row of rows ?? []) {
    const cur = String(row.currency ?? "").toUpperCase();
    if (!cur) continue;
    out[cur] = (out[cur] ?? 0) + Number(row.balance ?? 0);
  }
  return out;
}

function mapPayoutError(e: unknown): { error: string; message?: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const low = msg.toLowerCase();
  if (low.includes("insufficient")) return { error: "insufficient_funds" };
  if (
    low.includes("no such external") ||
    low.includes("could not find a debit") ||
    low.includes("no default") ||
    low.includes("bank_account") ||
    low.includes("cannot create a payout")
  ) {
    return { error: "no_bank" };
  }
  return { error: "payout_failed", message: msg };
}

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
