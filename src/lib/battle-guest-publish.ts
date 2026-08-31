/** Native battle-guest publish: Camera Kit frames, not MediaStreamTrack.clone(). */

export const BATTLE_GUEST_VIDEO = {
  width: 960,
  height: 540,
  frameRate: 24,
  maxBitrate: 700_000,
} as const;

export type BattleGuestPublishPath = "native_kit" | "js_audio_only";

export function pickBattleGuestPublishPath(opts: {
  nativeMethod: boolean;
  kitPublishing?: boolean;
}): BattleGuestPublishPath {
  if (opts.nativeMethod && opts.kitPublishing !== false) return "native_kit";
  return "js_audio_only";
}

export function shouldSubscribeBattleHudParticipant(
  identity: string,
  hostIdentity: string,
): boolean {
  if (!identity || identity === hostIdentity) return false;
  if (identity.startsWith("hud_")) return false;
  return identity.startsWith("battle_");
}

export function describeMediaTrack(track: {
  readyState?: string;
  getSettings?: () => { width?: number; height?: number };
} | null | undefined): { readyState: string; width: number; height: number } {
  const settings = track?.getSettings?.() ?? {};
  return {
    readyState: track?.readyState ?? "missing",
    width: Number(settings.width) || 0,
    height: Number(settings.height) || 0,
  };
}
