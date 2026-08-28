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

/** Profile row can lag a few hundred ms after signup — retry transient RPC errors. */
export async function applyPromoCodeWithRetry(
  code: string,
  attempts = 6,
): Promise<{ ok: boolean; error?: string }> {
  const c = code.trim();
  if (!c) return { ok: false, error: "invalid_code" };
  let last: { ok: boolean; error?: string } = { ok: false, error: "unknown" };
  for (let i = 0; i < attempts; i++) {
    last = await applyPromoCode(c);
    if (last.ok || last.error === "already_referred") return { ok: true };
    if (
      last.error === "invalid_code" ||
      last.error === "self_referral" ||
      last.error === "window_expired"
    ) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return last;
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

// ---------------------------------------------------------------------------
// Admin — promo codes & code requests (same RPCs as kidiplus.com)
// ---------------------------------------------------------------------------

export type AdminPromoCodeRow = {
  id: string;
  code: string;
  owner_id: string | null;
  owner_handle: string | null;
  owner_name: string | null;
  reward_quota: number;
  active: boolean;
  created_at: string;
  signups: number;
  orders_credited: number;
  totals: Record<string, number>;
  claim_token: string | null;
  claimed_at: string | null;
  held_totals: Record<string, number>;
};

export async function fetchAdminPromoCodes(): Promise<AdminPromoCodeRow[]> {
  try {
    const data = await rpc("admin_list_promo_codes", {});
    return ((data as { rows?: AdminPromoCodeRow[] } | null)?.rows ?? []) as AdminPromoCodeRow[];
  } catch {
    return [];
  }
}

export async function adminCreatePromoCode(
  code: string,
  ownerId: string | null = null,
  rewardQuota = 14,
): Promise<{ ok: true; id: string; code: string; claim_token: string } | { ok: false; error: string }> {
  try {
    const data = await rpc("admin_create_promo_code", {
      _code: code.trim().toUpperCase(),
      _owner_id: ownerId,
      _reward_quota: rewardQuota,
    });
    const r = (data ?? {}) as {
      ok?: boolean;
      error?: string;
      id?: string;
      code?: string;
      claim_token?: string;
    };
    return r.ok
      ? { ok: true, id: String(r.id), code: String(r.code), claim_token: String(r.claim_token) }
      : { ok: false, error: r.error ?? "unknown" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function adminRenewPromoCredits(
  promoCodeId: string,
  amount = 14,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  try {
    const data = await rpc("admin_renew_promo_credits", {
      _promo_code_id: promoCodeId,
      _amount: amount,
    });
    const r = (data ?? {}) as { ok?: boolean; error?: string; updated?: number };
    return r.ok ? { ok: true, updated: Number(r.updated ?? 0) } : { ok: false, error: r.error ?? "unknown" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function adminSetPromoActive(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await rpc("admin_set_promo_code_active", { _id: id, _active: active });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export type AdminPromoCodeRequestRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  user_id: string;
  user_handle: string | null;
  user_name: string | null;
  created_promo_code_id: string | null;
};

export async function fetchAdminPromoCodeRequests(
  status: "pending" | "approved" | "rejected" | null = "pending",
): Promise<AdminPromoCodeRequestRow[]> {
  try {
    const data = await rpc("admin_list_promo_code_requests", { _status: status });
    return ((data as { rows?: AdminPromoCodeRequestRow[] } | null)?.rows ?? []) as AdminPromoCodeRequestRow[];
  } catch {
    return [];
  }
}

export async function adminReviewPromoCodeRequest(
  id: string,
  action: "approve" | "reject",
  opts: { code?: string; reward_quota?: number; note?: string } = {},
): Promise<{ ok: true; code?: string } | { ok: false; error: string }> {
  try {
    const data = await rpc("admin_review_promo_code_request", {
      _id: id,
      _action: action,
      _code: opts.code ?? null,
      _reward_quota: opts.reward_quota ?? 14,
      _note: opts.note ?? null,
    });
    const r = (data ?? {}) as { ok?: boolean; error?: string; code?: string };
    return r.ok ? { ok: true, ...(r.code ? { code: r.code } : {}) } : { ok: false, error: r.error ?? "unknown" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export function buildShareMessage(code: string, lang: string): string {
  const url = `https://kidiplus.com/join/${encodeURIComponent(code)}`;
  if (lang.startsWith("en")) return `Join me on KiDi+ 🎁 Use my code ${code} at signup: ${url}`;
  return `Rejoins-moi sur KiDi+ 🎁 Utilise mon code ${code} à l'inscription : ${url}`;
}

/** Message WhatsApp : code public + token d'activation secret. */
export function buildInfluencerOnboardingMessage(
  code: string,
  token: string,
  lang: "fr" | "en" = "fr",
): string {
  const publicCode = code.trim().toUpperCase();
  const claim = token.trim().toUpperCase();
  if (lang === "en") {
    return [
      `Welcome to the KiDi+ Gold Partner programme ✨`,
      ``,
      `Your public code (share with your community): ${publicCode}`,
      `Your secret activation code (keep it private): ${claim}`,
      ``,
      `How it works:`,
      `1. Open KiDi+ → Profile → Referral`,
      `2. Scratch the card and enter your secret code`,
      `3. Share ${publicCode} — anyone who signs up with it is linked to you for life`,
      `4. You earn 10% of KiDi+'s commission on their first 14 orders (as buyer or seller)`,
      ``,
      `Held earnings from people who already used ${publicCode} are paid to you when you claim.`,
    ].join("\n");
  }
  return [
    `Bienvenue dans le programme KiDi+ Gold Partenaire ✨`,
    ``,
    `Ton code public (à partager) : ${publicCode}`,
    `Ton code d'activation secret (à garder pour toi) : ${claim}`,
    ``,
    `Comment ça marche :`,
    `1. Ouvre KiDi+ → Profil → Parrainage`,
    `2. Gratte la carte et entre ton code secret`,
    `3. Partage ${publicCode} — toute inscription avec ce code est rattachée à toi à vie`,
    `4. Tu gagnes 10 % de la commission KiDi+ sur les 14 premières commandes de tes filleuls (acheteur ou vendeur)`,
    ``,
    `Les gains déjà accumulés avec ${publicCode} te sont versés d'un coup à la réclamation.`,
  ].join("\n");
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
