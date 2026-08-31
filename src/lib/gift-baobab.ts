/** Baobab d'or — grows for 3s, then the leaves fall asleep. Same timing as the site. */

export const BAOBAB_GROW_S = 3;
export const BAOBAB_SLEEP_S = 3.6;
export const BAOBAB_FADE_S = 0.7;
export const BAOBAB_DURATION_MS = Math.round((BAOBAB_GROW_S + BAOBAB_SLEEP_S + BAOBAB_FADE_S) * 1000);

export const BAOBAB_PHASE = {
  sproutEnd: 0.45,
  trunkEnd: 1.35,
  branchEnd: 2.25,
  growEnd: BAOBAB_GROW_S,
  sleepEnd: BAOBAB_GROW_S + BAOBAB_SLEEP_S,
} as const;

export function baobabProgress(elapsedMs: number): {
  t: number;
  grow: number;
  sleep: number;
  fade: number;
  label: number;
} {
  const t = Math.max(0, elapsedMs) / 1000;
  const grow = clamp01(t / BAOBAB_GROW_S);
  const sleep = t <= BAOBAB_GROW_S ? 0 : clamp01((t - BAOBAB_GROW_S) / BAOBAB_SLEEP_S);
  const fadeStart = BAOBAB_GROW_S + BAOBAB_SLEEP_S;
  const fade = t <= fadeStart ? 0 : clamp01((t - fadeStart) / BAOBAB_FADE_S);
  const nameIn = easeOutCubic(range(t, BAOBAB_GROW_S - 0.25, BAOBAB_GROW_S + 0.35));
  const nameOut = 1 - range(t, BAOBAB_GROW_S + 2.4, BAOBAB_GROW_S + 3.1);
  return { t, grow, sleep, fade, label: nameIn * nameOut };
}

export function isBaobabGiftKey(key: string | null | undefined): boolean {
  const k = (key ?? "").toLowerCase();
  return k === "baobab" || k === "kidi";
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function range(t: number, a: number, b: number) {
  if (b <= a) return t >= b ? 1 : 0;
  return clamp01((t - a) / (b - a));
}

function easeOutCubic(x: number) {
  return 1 - (1 - x) ** 3;
}
