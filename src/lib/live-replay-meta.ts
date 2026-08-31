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
