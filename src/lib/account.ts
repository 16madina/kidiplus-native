import { supabase } from "./supabase";

export type AccountDeletionCheck =
  | {
      ok: true;
      wallet_balance: number;
      pending_payouts: number;
      pending_orders: number;
      live_now: number;
      has_blockers: boolean;
    }
  | { ok: false; error: string };

export async function accountDeletionCheck(): Promise<AccountDeletionCheck> {
  const { data, error } = await supabase.rpc("account_deletion_check");
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "unknown" }) as AccountDeletionCheck;
}

/** Permanently delete the signed-in account (same API as kidiplus.com). */
export async function deleteMyAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "unauthorized" };
  try {
    const res = await fetch("https://kidiplus.com/api/account/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Origin: "https://kidiplus.com",
      },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: String(body.error ?? `http_${res.status}`) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
