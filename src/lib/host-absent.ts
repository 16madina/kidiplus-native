/** Warn the host via push after this many minutes without a heartbeat. */
export const HOST_ABSENT_WARN_MINUTES = 2;
/** Auto-end an abandoned live after this many minutes without a heartbeat. */
export const HOST_ABSENT_EXPIRE_MINUTES = 5;

export function hostLastSeenMs(
  hostLastSeenAt: string | null | undefined,
  startedAt: string,
): number {
  const raw = hostLastSeenAt || startedAt;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/** Whole minutes remaining before auto-close, never below 1 while the row is still open. */
export function minutesUntilHostExpire(
  hostLastSeenAt: string | null | undefined,
  startedAt: string,
  now = Date.now(),
  maxAgeMinutes = HOST_ABSENT_EXPIRE_MINUTES,
): number {
  const closesAt = hostLastSeenMs(hostLastSeenAt, startedAt) + maxAgeMinutes * 60_000;
  return Math.max(1, Math.ceil((closesAt - now) / 60_000));
}

export function isAbandonedLive(
  row: { host_last_seen_at: string | null; started_at: string },
  maxAgeMinutes = HOST_ABSENT_EXPIRE_MINUTES,
  now = Date.now(),
): boolean {
  const last = row.host_last_seen_at || row.started_at;
  const cutoff = new Date(now - maxAgeMinutes * 60_000).toISOString();
  return last < cutoff;
}
