/** Viewer-facing auction countdown, matching the live demo card ("19s"). */
export function formatAuctionSeconds(seconds: number): string {
  const left = Math.max(0, Math.floor(seconds));
  if (left >= 60) {
    const mm = Math.floor(left / 60);
    const ss = left % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }
  return `${left}s`;
}
