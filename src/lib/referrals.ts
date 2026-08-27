import { supabase } from "./supabase";
import { normalizeCurrency } from "./money";

type Rpc = { data: unknown; error: { message?: string } | null };

async function rpc(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = (await supabase.rpc(fn, args ?? {})) as Rpc;
  if (error) throw new Error(error.message);
  return data;
}

export type PromoCodeStats = {
  id: string;
  code: string;
  reward_quota: number;
  active: boolean;
  created_at: string;
  signups: number;
  orders_credited: number;
  totals: Record<string, number>;
};

export type ReferralEarningRow = {
  id: string;
  amount: number;
  currency: string;
  status: "credited" | "reversed";
  created_at: string;
  order_id: string;
  referred_user_id: string;
  referred_handle: string | null;
  referred_name: string | null;
  item_name: string | null;
};

export type ReferralBalance = {
  owner_id: string;
  available: number;
  currency: string;
  updated_at: string;
};

export type MyPromoCodeRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function validatePromoCode(code: string): Promise<boolean> {
  const c = code.trim();
  if (!c) return false;
  try {
    const data = await rpc("validate_promo_code", { _code: c });
    return Boolean((data as { valid?: boolean } | null)?.valid);
  } catch {
    return false;
  }
}

export async function applyPromoCode(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const data = await rpc("apply_promo_code", { _code: code.trim() });
    const r = (data ?? {}) as { ok?: boolean; error?: string };
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "unknown" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function fetchMyPromoCodes(): Promise<PromoCodeStats[]> {
  try {
    const data = await rpc("my_promo_codes", {});
    return ((data as { rows?: PromoCodeStats[] } | null)?.rows ?? []) as PromoCodeStats[];
  } catch {
    return [];
  }
}

export async function fetchMyReferralEarnings(limit = 50): Promise<ReferralEarningRow[]> {
  try {
    const data = await rpc("my_referral_earnings", { _limit: limit });
    return ((data as { rows?: ReferralEarningRow[] } | null)?.rows ?? []) as ReferralEarningRow[];
  } catch {
    return [];
  }
}

export async function fetchMyReferralBalance(userId: string): Promise<ReferralBalance | null> {
  const { data } = await supabase.from("referral_balances").select("*").eq("owner_id", userId).maybeSingle();
  return (data ?? null) as ReferralBalance | null;
}

export function subscribeMyReferralBalance(userId: string, onChange: () => void): () => void {
  const ch = supabase
    .channel(`referral_balance:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "referral_balances", filter: `owner_id=eq.${userId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(ch);
  };
}

export async function claimPromoCode(
  token: string,
): Promise<
  | { ok: true; code: string; promo_code_id: string; backfilled_totals: Record<string, number> }
  | { ok: false; error: string }
> {
  try {
    const data = await rpc("claim_promo_code", { _token: token.trim().toUpperCase() });
    const r = (data ?? {}) as {
      ok?: boolean;
      error?: string;
      code?: string;
      promo_code_id?: string;
      backfilled_totals?: Record<string, number>;
    };
    return r.ok
      ? {
          ok: true,
          code: String(r.code),
          promo_code_id: String(r.promo_code_id),
          backfilled_totals: r.backfilled_totals ?? {},
        }
      : { ok: false, error: r.error ?? "unknown" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function fetchMyPromoCodeRequest(): Promise<MyPromoCodeRequest | null> {
  try {
    const data = await rpc("my_promo_code_request", {});
    return (data ?? null) as MyPromoCodeRequest | null;
  } catch {
    return null;
  }
}

export async function submitPromoCodeRequest(
  message: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const data = await rpc("request_promo_code", { _message: message });
    const r = (data ?? {}) as { ok?: boolean; error?: string; id?: string };
    return r.ok ? { ok: true, id: String(r.id) } : { ok: false, error: r.error ?? "unknown" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export function buildShareMessage(code: string, lang: string): string {
  const url = `https://kidiplus.com/join/${encodeURIComponent(code)}`;
  if (lang.startsWith("en")) return `Join me on KiDi+ 🎁 Use my code ${code} at signup: ${url}`;
  return `Rejoins-moi sur KiDi+ 🎁 Utilise mon code ${code} à l'inscription : ${url}`;
}

export function formatTotals(totals: Record<string, number>, locale: string): string {
  const entries = Object.entries(totals);
  if (entries.length === 0) return "—";
  return entries
    .map(([cur, amt]) => {
      const n = Number(amt);
      const c = normalizeCurrency(cur);
      try {
        return new Intl.NumberFormat(locale.startsWith("en") ? "en-GB" : "fr-FR", {
          style: "currency",
          currency: c,
          maximumFractionDigits: c === "XOF" ? 0 : 2,
        }).format(n);
      } catch {
        return `${n} ${c}`;
      }
    })
    .join(" · ");
}
