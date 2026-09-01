export const REPLAY_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/** Whole days remaining until expiry (ceil), min 1 while still playable. */
export function replayDaysLeft(expiresAt: string | null | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function replayDownloadFilename(title?: string | null, now = new Date()): string {
  const base = (title ?? "live")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const stamp = now.toISOString().slice(0, 10);
  return `kidiplus-${base || "live"}-${stamp}.mp4`;
}

export type SellerReplayKind = "live" | "scheduled" | "ready" | "pending" | "failed" | "expired" | "ended";

export function sellerReplayKind(
  row: {
    status: string;
    replay_status?: string | null;
    replay_expires_at?: string | null;
  },
  now = Date.now(),
): SellerReplayKind {
  if (row.status === "live") return "live";
  if (row.status === "scheduled") return "scheduled";
  const expires = row.replay_expires_at ? new Date(row.replay_expires_at).getTime() : null;
  const expired = expires != null && expires <= now;
  if (row.replay_status === "ready" && !expired) return "ready";
  if (row.replay_status === "recording" || row.replay_status === "processing") return "pending";
  if (row.replay_status === "failed") return "failed";
  if (row.replay_status === "expired" || expired) return "expired";
  return "ended";
}

/** Past lives stay listed for 7 days (or until the stored replay expiry). */
export function sellerLiveStillListed(
  row: {
    status: string;
    ended_at?: string | null;
    started_at?: string | null;
    replay_status?: string | null;
    replay_expires_at?: string | null;
  },
  now = Date.now(),
): boolean {
  if (row.status === "live" || row.status === "scheduled") return true;
  if (sellerReplayKind(row, now) === "ready") return true;
  if (row.replay_expires_at) return new Date(row.replay_expires_at).getTime() > now;
  const ref = row.ended_at || row.started_at;
  if (!ref) return true;
  const at = Date.parse(ref);
  if (!Number.isFinite(at)) return true;
  return now - at < REPLAY_KEEP_MS;
}
