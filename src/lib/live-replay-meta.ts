export const REPLAY_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export type SellerReplayKind =
  | "live"
  | "scheduled"
  | "ready"
  | "pending"
  | "failed"
  | "expired"
  | "ended";

export function replayDaysLeft(
  expiresAt: string | null | undefined,
  endedAt: string | null | undefined = null,
  now = Date.now(),
): number | null {
  const explicit = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const ended = endedAt ? Date.parse(endedAt) : Number.NaN;
  const timestamp = Number.isFinite(explicit)
    ? explicit
    : Number.isFinite(ended)
      ? ended + REPLAY_KEEP_MS
      : Number.NaN;
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - now) / (24 * 60 * 60 * 1000)));
}

export function sellerReplayKind(
  row: {
    status: string;
    replay_status?: string | null;
    replay_url?: string | null;
    replay_expires_at?: string | null;
    ended_at?: string | null;
  },
  now = Date.now(),
): SellerReplayKind {
  if (row.status === "live") return "live";
  if (row.status === "scheduled") return "scheduled";
  const days = replayDaysLeft(row.replay_expires_at, row.ended_at, now);
  const expiredByClock = days === 0;
  if (row.replay_status === "expired" || expiredByClock) return "expired";
  if (row.replay_status === "failed") return "failed";
  if (row.replay_status === "ready" || (row.replay_status === "processing" && row.replay_url)) {
    return "ready";
  }
  if (
    row.replay_status === "recording" ||
    row.replay_status === "processing" ||
    row.replay_status == null
  ) {
    return "pending";
  }
  return "ended";
}

export function sellerLiveStillListed(
  row: {
    status: string;
    ended_at?: string | null;
    replay_expires_at?: string | null;
  },
  now = Date.now(),
): boolean {
  if (row.status === "live" || row.status === "scheduled") return true;
  const days = replayDaysLeft(row.replay_expires_at, row.ended_at, now);
  return days == null || days > 0;
}
