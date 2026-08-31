export const DEFI_PLUS_COUNT_FROM = 10;
export const DEFI_PLUS_HIT_S = 10;
export const DEFI_PLUS_NAME_HOLD_S = 3;
export const DEFI_PLUS_DURATION_MS = 15_000;

export const PHASE = {
  enterEnd: 2.2,
  braidEnd: 4,
  medalReady: 5,
  beatStart: 5,
} as const;

export function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function range(t: number, a: number, b: number) {
  if (b === a) return t >= b ? 1 : 0;
  return clamp01((t - a) / (b - a));
}

export function easeOutCubic(u: number) {
  return 1 - (1 - u) ** 3;
}

export function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

export function heartbeat(t: number) {
  const u = t - Math.floor(t);
  if (u < 0.13) return Math.sin((u / 0.13) * Math.PI);
  if (u > 0.18 && u < 0.32) return 0.58 * Math.sin(((u - 0.18) / 0.14) * Math.PI);
  return 0;
}

export function defiPlusRemaining(elapsedMs: number): number {
  return Math.max(0, DEFI_PLUS_COUNT_FROM - Math.floor(elapsedMs / 1000));
}

export function defiPlusElapsedMs(startsAt: number, now = Date.now()) {
  return Math.max(0, now - startsAt);
}

export function isDefiPlusIntroActive(startsAt: number | null | undefined, now = Date.now()) {
  if (startsAt == null || !Number.isFinite(startsAt)) return false;
  return defiPlusElapsedMs(startsAt, now) < DEFI_PLUS_DURATION_MS;
}
