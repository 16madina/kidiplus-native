import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "./supabase";
import type { MoneyByCur } from "./admin-treasury-logic";

export type TreasurySnapshot = {
  ok: boolean;
  livemode: boolean;
  generatedAt: string;
  stripeAvailable: MoneyByCur;
  stripePending: MoneyByCur;
  stripeTotal: MoneyByCur;
  owedSellers: MoneyByCur;
  walletFloat: MoneyByCur;
  commission: MoneyByCur;
  payoutable: MoneyByCur;
  paid?: number;
  currency?: string;
  payoutId?: string;
  error?: string;
  message?: string;
  min?: number;
};

function emptyMaps(): Pick<
  TreasurySnapshot,
  | "stripeAvailable"
  | "stripePending"
  | "stripeTotal"
  | "owedSellers"
  | "walletFloat"
  | "commission"
  | "payoutable"
> {
  return {
    stripeAvailable: {},
    stripePending: {},
    stripeTotal: {},
    owedSellers: {},
    walletFloat: {},
    commission: {},
    payoutable: {},
  };
}

function asMoneyMap(value: unknown): MoneyByCur {
  if (!value || typeof value !== "object") return {};
  const out: MoneyByCur = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(v);
    if (k) out[k.toUpperCase()] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

function asSnapshot(json: Record<string, unknown>): TreasurySnapshot {
  return {
    ok: json.ok === true && !json.error,
    livemode: json.livemode === true,
    generatedAt: typeof json.generatedAt === "string" ? json.generatedAt : "",
    stripeAvailable: asMoneyMap(json.stripeAvailable),
    stripePending: asMoneyMap(json.stripePending),
    stripeTotal: asMoneyMap(json.stripeTotal),
    owedSellers: asMoneyMap(json.owedSellers),
    walletFloat: asMoneyMap(json.walletFloat),
    commission: asMoneyMap(json.commission),
    payoutable: asMoneyMap(json.payoutable),
    paid: typeof json.paid === "number" ? json.paid : undefined,
    currency: typeof json.currency === "string" ? json.currency : undefined,
    payoutId: typeof json.payoutId === "string" ? json.payoutId : undefined,
    error: typeof json.error === "string" ? json.error : undefined,
    message: typeof json.message === "string" ? json.message : undefined,
    min: typeof json.min === "number" ? json.min : undefined,
  };
}

async function postTreasury(body: Record<string, unknown>): Promise<TreasurySnapshot> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, livemode: false, generatedAt: "", error: "unauthorized", ...emptyMaps() };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-stripe-treasury`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 404) {
      return { ok: false, livemode: false, generatedAt: "", error: "not_deployed", ...emptyMaps() };
    }
    if (!res.ok && !json.error) {
      return { ok: false, livemode: false, generatedAt: "", error: "http_error", message: `HTTP ${res.status}`, ...emptyMaps() };
    }
    return asSnapshot(json);
  } catch (e) {
    return {
      ok: false,
      livemode: false,
      generatedAt: "",
      error: "network_error",
      message: e instanceof Error ? e.message : "network",
      ...emptyMaps(),
    };
  }
}

export function fetchAdminTreasury(): Promise<TreasurySnapshot> {
  return postTreasury({ action: "balance" });
}

export function payoutAdminCommission(currency: string, amount?: number): Promise<TreasurySnapshot> {
  return postTreasury({
    action: "payout",
    currency,
    ...(typeof amount === "number" ? { amount } : {}),
  });
}

export function treasuryErrorKey(error?: string): string {
  switch (error) {
    case "not_deployed":
      return "admin.treasury.notDeployed";
    case "unauthorized":
    case "forbidden":
      return "admin.treasury.forbidden";
    case "insufficient_funds":
      return "admin.treasury.insufficient";
    case "no_bank":
      return "admin.treasury.noBank";
    case "nothing_to_payout":
      return "admin.treasury.payoutNone";
    case "currency_unsupported":
      return "admin.treasury.currency";
    case "stripe_config":
      return "admin.treasury.stripeConfig";
    default:
      return "admin.treasury.error";
  }
}
