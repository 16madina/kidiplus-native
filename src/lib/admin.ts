import { supabase } from "./supabase";

type Rpc = { data: unknown; error: { message?: string } | null };

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const { data, error } = (await supabase.rpc(fn, args ?? {})) as Rpc;
  if (error) return null;
  return data as T;
}

export type CurrencyMap = Record<string, number>;

export type OverviewStats = {
  gmv: CurrencyMap;
  gmv_month: CurrencyMap;
  revenue: CurrencyMap;
  revenue_month: CurrencyMap;
  wallet_float: CurrencyMap;
  seller_liability: CurrencyMap;
  pending_payouts: { count: number; by_currency: CurrencyMap };
  orders_daily: Array<{ day: string; orders: number; gmv: number }>;
  counts: {
    users_total: number;
    sellers: number;
    admins: number;
    new_this_week: number;
    lives_total: number;
    lives_live: number;
    orders_paid: number;
  };
  generated_at: string;
};

export async function fetchOverviewStats(): Promise<OverviewStats | null> {
  return rpc<OverviewStats>("admin_overview_stats");
}

export type AdminUserRow = {
  id: string;
  display_name: string;
  handle: string;
  country: string | null;
  is_seller: boolean;
  is_admin: boolean;
  created_at: string;
  wallet_balance: number;
  wallet_currency: string;
  orders_count: number;
  sales_count: number;
};

export async function fetchAdminUsers(
  search: string | null,
  limit = 40,
  offset = 0,
): Promise<{ rows: AdminUserRow[]; total: number }> {
  const data = await rpc<{ rows?: AdminUserRow[]; total?: number }>("admin_list_users", {
    _search: search,
    _limit: limit,
    _offset: offset,
  });
  if (!data) return { rows: [], total: 0 };
  return { rows: data.rows ?? [], total: Number(data.total ?? 0) };
}

export type AdminPayoutRow = {
  id: string;
  seller_handle: string | null;
  seller_name: string | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  requested_at: string;
};

export async function fetchAdminPayouts(status: string | null = "requested"): Promise<AdminPayoutRow[]> {
  const data = await rpc<{ rows?: AdminPayoutRow[] }>("admin_list_payouts", {
    _status: status,
    _limit: 200,
  });
  return data?.rows ?? [];
}

export async function adminProcessPayout(
  payoutId: string,
  action: "paid" | "rejected",
): Promise<{ ok: boolean; error?: string }> {
  const data = await rpc<{ ok?: boolean; error?: string }>("admin_process_payout", {
    _payout_id: payoutId,
    _action: action,
    _note: null,
    _proof_url: null,
    _admin_note: null,
  });
  if (!data) return { ok: false, error: "rpc failed" };
  return data.ok ? { ok: true } : { ok: false, error: data.error };
}

export type AdminLiveRow = {
  id: string;
  title: string;
  status: string;
  viewer_count: number;
  started_at: string;
  seller_handle: string | null;
  seller_name: string | null;
  gmv: number;
  currency: string;
};

export async function fetchAdminLives(status: string | null = null): Promise<AdminLiveRow[]> {
  const data = await rpc<{ rows?: AdminLiveRow[] }>("admin_list_lives", {
    _status: status,
    _limit: 100,
  });
  return data?.rows ?? [];
}

export async function adminEndLive(liveId: string): Promise<boolean> {
  const data = await rpc<{ ok?: boolean }>("admin_end_live", { _live_id: liveId });
  return !!data?.ok;
}

export type AdminRiskAlertRow = {
  id: string;
  user_id: string | null;
  kind: string;
  created_at: string;
  resolved_at: string | null;
  user_handle: string | null;
  user_name: string | null;
  risk_restricted: boolean;
};

export async function fetchAdminRiskAlerts(
  status: "open" | "resolved" | "all" = "open",
): Promise<AdminRiskAlertRow[]> {
  const data = await rpc<{ rows?: AdminRiskAlertRow[]; ok?: boolean }>("admin_list_risk_alerts", {
    _status: status,
    _limit: 50,
    _offset: 0,
  });
  return data?.rows ?? [];
}

export async function resolveAdminRiskAlert(alertId: string): Promise<boolean> {
  const data = await rpc<{ ok?: boolean }>("admin_resolve_risk_alert", { _alert_id: alertId });
  return !!data?.ok;
}

export async function setAdminRiskRestricted(userId: string, restricted: boolean): Promise<boolean> {
  const data = await rpc<{ ok?: boolean }>("admin_set_risk_restricted", {
    _user_id: userId,
    _restricted: restricted,
  });
  return !!data?.ok;
}

export type ReportRow = {
  id: string;
  reporter_handle: string | null;
  target_type: string;
  target_label: string | null;
  target_user_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};

export async function fetchAdminReports(status: string | null = "open"): Promise<ReportRow[]> {
  const data = await rpc<{ rows?: ReportRow[] }>("admin_list_reports", {
    _status: status,
    _limit: 200,
  });
  return data?.rows ?? [];
}

export async function adminResolveReport(
  reportId: string,
  status: "reviewed" | "actioned" | "dismissed",
): Promise<boolean> {
  const data = await rpc<{ ok?: boolean }>("admin_resolve_report", {
    _report_id: reportId,
    _status: status,
    _note: null,
  });
  return !!data?.ok;
}

export async function adminIssueSanction(userId: string, type: "warning" | "suspension" | "ban", reason: string) {
  return rpc<{ ok?: boolean; error?: string }>("admin_issue_sanction", {
    _user_id: userId,
    _type: type,
    _reason: reason,
    _note: null,
    _expires_at: type === "suspension" ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() : null,
  });
}

export type PendingVerification = {
  id: string;
  user_id: string;
  message: string | null;
  created_at: string;
  profile?: { display_name?: string | null; handle?: string | null } | Array<{ display_name?: string | null; handle?: string | null }> | null;
};

export async function fetchPendingVerifications(): Promise<PendingVerification[]> {
  const { data, error } = await supabase
    .from("verification_requests")
    .select(
      "id, user_id, message, created_at, profile:profiles!verification_requests_user_id_fkey(display_name, handle)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as unknown as PendingVerification[];
}

export async function reviewVerification(id: string, approve: boolean): Promise<boolean> {
  const data = await rpc<{ ok?: boolean }>("admin_review_verification", {
    _id: id,
    _approve: approve,
  });
  return !!data?.ok;
}

export async function fetchPrelaunchSimEnabled(): Promise<boolean> {
  const data = await rpc<unknown>("admin_get_prelaunch_live_sim");
  if (data == null) return false;
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return !!(parsed as { enabled?: boolean }).enabled;
  } catch {
    return false;
  }
}

export async function setPrelaunchSimEnabled(enabled: boolean): Promise<boolean> {
  const payload = JSON.stringify({
    enabled,
    viewersMin: 12,
    viewersMax: 48,
    commentsPerMin: 8,
    bidsPerMin: 2,
  });
  const data = await rpc<unknown>("admin_set_prelaunch_live_sim", { _value: payload });
  return data != null;
}

export function verificationHandle(row: PendingVerification): string {
  const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  return p?.handle || p?.display_name || "utilisateur";
}

export function firstCurrency(map: CurrencyMap | undefined): { amount: number; currency: string } {
  if (!map) return { amount: 0, currency: "EUR" };
  const [currency, amount] = Object.entries(map)[0] ?? ["EUR", 0];
  return { amount: Number(amount) || 0, currency };
}
