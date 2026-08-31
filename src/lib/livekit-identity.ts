export function guestLiveKitIdentity(): string {
  return `guest_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Second LiveKit identity for the iOS native PiP viewer.
 * LiveKit rejects two connections with the same identity — the RN viewer
 * already uses `userId` / `guest_*`, so PiP must be distinct.
 * Guests must stay `guest_*` (server `/api/livekit-token` rule).
 */
export function livePipViewerIdentity(userId: string | null | undefined): string {
  if (userId) return `${userId}-pip`;
  return `guest_pip_${Math.random().toString(36).slice(2, 10)}`;
}
