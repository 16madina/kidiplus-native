export const DEFI_PLUS_COUNT_FROM = 10;
export const DEFI_PLUS_HIT_S = 10;
export const DEFI_PLUS_NAME_HOLD_S = 3;
/** After VS + names have been held, they fade out over this many seconds. */
export const DEFI_PLUS_NAME_FADE_S = 3;
/** Intro overlay outlives the 15s match countdown so the names can fade slowly. */
export const DEFI_PLUS_DURATION_MS = Math.round(
  (DEFI_PLUS_HIT_S + 1.7 + DEFI_PLUS_NAME_HOLD_S + DEFI_PLUS_NAME_FADE_S + 0.3) * 1000,
);

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

export function easeInCubic(u: number) {
  return u * u * u;
}

export function easeInOutCubic(u: number) {
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

export function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

export function smootherstep(u: number) {
  const x = clamp01(u);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Ease in, then constant speed — never parks before the end. */
export function cruise(u: number) {
  const x = clamp01(u);
  if (x < 0.12) return easeInCubic(x / 0.12) * 0.12;
  return x;
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

/** Server `started_at` if valid, otherwise the local fallback (set once when the duel starts). */
export function resolveDefiPlusIntroStart(
  serverStartedAt: string | null | undefined,
  fallbackNow: number | null,
): number | null {
  if (serverStartedAt) {
    const parsed = Date.parse(serverStartedAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallbackNow;
}
