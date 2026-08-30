// Settle a stripe_connect payout row with a Transfer on the same Stripe
// key that created the Express account. kidiplus.com /api/connect/payout
// is the live-web path; this function keeps native withdrawals on the
// account that onboarding just wrote.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { accountLivemode, isStripeConfigError, stripeClient } from "../_shared/stripe.ts";
import { connectStatusFromAccount } from "../_shared/connect-profile.ts";

const CONNECT_CURRENCIES = new Set(["EUR", "CAD", "USD", "GBP"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const settleSecret = Deno.env.get("SETTLE_PAYOUT_SECRET") ?? "";
    const settleOk = Boolean(
      settleSecret && req.headers.get("x-settle-secret") === settleSecret,
    );
    const { data: userData, error: userErr } = settleOk
      ? { data: { user: null }, error: null }
      : await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!settleOk && (userErr || !userData?.user)) return json({ error: "unauthorized" }, 401);
    const stripe = stripeClient();

    const payoutId = typeof body.payoutId === "string" ? body.payoutId.trim() : "";
    if (!payoutId || !/^[0-9a-f-]{36}$/i.test(payoutId)) {
      return json({ error: "invalid_payout_id" }, 400);
    }

    const { data: payout } = await supabase
      .from("payouts")
      .select("id, seller_id, amount, currency, method, status, stripe_transfer_id")
      .eq("id", payoutId)
      .maybeSingle();
    if (!payout) return json({ error: "payout_not_found" }, 404);
    const row = payout as Record<string, unknown>;
    const userId = settleOk ? String(row.seller_id ?? "") : userData!.user!.id;
    if (!userId || row.seller_id !== userId) return json({ error: "forbidden" }, 403);
    if (row.method !== "stripe_connect") return json({ error: "not_connect_method" }, 400);
    if (row.status === "paid" || row.status === "rejected") {
      return json({ error: "already_processed", status: row.status }, 409);
    }
    if (typeof row.stripe_transfer_id === "string" && row.stripe_transfer_id) {
      return json({ ok: true, transferId: row.stripe_transfer_id, alreadySent: true });
    }

    if (body.refund === true) {
      const refunded = await refundPayout(supabase, payoutId, userId, "Annulé : le virement Stripe n'est pas parti. Gains recrédités.");
      return json(refunded.ok ? { ok: true, refunded: true } : { error: refunded.error }, refunded.ok ? 200 : 409);
    }

    const currency = String(row.currency ?? "EUR").toUpperCase();
    if (!CONNECT_CURRENCIES.has(currency)) {
      return json({ error: "connect_currency_unsupported", currency }, 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_connect_id, connect_status")
      .eq("id", userId)
      .maybeSingle();
    const accountId =
      (typeof profile?.stripe_connect_id === "string" && profile.stripe_connect_id) ||
      (typeof profile?.stripe_account_id === "string" && profile.stripe_account_id) ||
      "";
    if (!accountId) return json({ error: "connect_not_ready", status: "none" }, 409);

    const account = await stripe.accounts.retrieve(accountId);
    const live = accountLivemode(account);
    if (!live) {
      await refundPayout(supabase, payoutId, userId, "Compte Stripe test — virement réel impossible. Gains recrédités.");
      return json({ error: "connect_test_mode", refunded: true }, 409);
    }
    const status = connectStatusFromAccount({ ...account, livemode: live });
    if (status !== "active") {
      await refundPayout(supabase, payoutId, userId, "Compte Stripe pas prêt. Gains recrédités.");
      return json({ error: "connect_not_ready", refunded: true, status }, 409);
    }

    const amountMinor = toStripeAmount(Number(row.amount), currency);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return json({ error: "invalid_amount" }, 400);
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: amountMinor,
          currency: currency.toLowerCase(),
          destination: accountId,
          description: `KiDi+ retrait ${payoutId}`,
          metadata: { payoutId, sellerId: userId },
        },
        { idempotencyKey: `kidi-payout-${payoutId}` },
      );
      await supabase
        .from("payouts")
        .update({
          stripe_transfer_id: transfer.id,
          stripe_error: null,
          status: "paid",
          processed_at: new Date().toISOString(),
          admin_note: "Stripe Connect (automatique)",
        })
        .eq("id", payoutId);
      return json({ ok: true, transferId: transfer.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("connect-payout transfer", msg);
      await supabase.from("payouts").update({ stripe_error: msg.slice(0, 400) }).eq("id", payoutId);
      await refundPayout(
        supabase,
        payoutId,
        userId,
        `Virement Stripe impossible (${msg.slice(0, 160)}). Gains recrédités.`,
      );
      return json({ error: "transfer_failed", refunded: true, message: msg }, 502);
    }
  } catch (e) {
    if (isStripeConfigError(e)) {
      return json({ error: e.code, message: e.message }, 503);
    }
    console.error("connect-payout", e);
    return json({ error: "server_error", message: String(e) }, 500);
  }
});

async function refundPayout(
  supabase: ReturnType<typeof createClient>,
  payoutId: string,
  userId: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: locked, error: lockErr } = await supabase
    .from("payouts")
    .update({
      status: "rejected",
      processed_at: new Date().toISOString(),
      admin_note: note,
    })
    .eq("id", payoutId)
    .eq("seller_id", userId)
    .in("status", ["requested", "processing"])
    .is("stripe_transfer_id", null)
    .select("amount, source")
    .maybeSingle();
  if (lockErr) return { ok: false, error: lockErr.message };
  if (!locked) return { ok: false, error: "already_processed" };
  const amount = Number((locked as { amount?: number }).amount);
  const source = String((locked as { source?: string }).source ?? "seller");
  const now = new Date().toISOString();
  if (source === "wallet") {
    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
    const next = Number((w as { balance?: number } | null)?.balance ?? 0) + amount;
    await supabase.from("wallets").update({ balance: next, updated_at: now }).eq("user_id", userId);
  } else if (source === "referral") {
    const { data: r } = await supabase
      .from("referral_balances")
      .select("available")
      .eq("owner_id", userId)
      .maybeSingle();
    const next = Number((r as { available?: number } | null)?.available ?? 0) + amount;
    await supabase.from("referral_balances").update({ available: next, updated_at: now }).eq("owner_id", userId);
  } else {
    const { data: b } = await supabase
      .from("seller_balances")
      .select("available")
      .eq("seller_id", userId)
      .maybeSingle();
    const next = Number((b as { available?: number } | null)?.available ?? 0) + amount;
    await supabase.from("seller_balances").update({ available: next, updated_at: now }).eq("seller_id", userId);
  }
  return { ok: true };
}

function toStripeAmount(amount: number, currency: string): number {
  return currency === "XOF" ? Math.round(amount) : Math.round(amount * 100);
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
