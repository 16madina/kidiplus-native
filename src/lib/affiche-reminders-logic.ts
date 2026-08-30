export function afficheReminderAllowed(eventAt: string | null | undefined, nowMs = Date.now()): {
  ok: boolean;
  reason: "ok" | "no_date" | "past";
} {
  if (!eventAt) return { ok: false, reason: "no_date" };
  const ms = new Date(eventAt).getTime();
  if (!Number.isFinite(ms)) return { ok: false, reason: "no_date" };
  if (ms <= nowMs + 15_000) return { ok: false, reason: "past" };
  return { ok: true, reason: "ok" };
}

export function formatAfficheWhenParts(
  iso: string | null | undefined,
  locale: string,
): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
  };
}

export function formatAfficheWhen(iso: string | null | undefined, locale: string): string | null {
  const parts = formatAfficheWhenParts(iso, locale);
  if (!parts) return null;
  return `${parts.date} · ${parts.time}`;
}

export type AfficheCountdown =
  | { kind: "none" }
  | { kind: "started" }
  | { kind: "tomorrow" }
  | { kind: "mins"; n: number }
  | { kind: "hours"; n: number }
  | { kind: "days"; n: number };

export function afficheCountdown(iso: string | null | undefined, nowMs = Date.now()): AfficheCountdown {
  if (!iso) return { kind: "none" };
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return { kind: "none" };
  const delta = ms - nowMs;
  if (delta <= 15_000) return { kind: "started" };
  const mins = Math.max(1, Math.round(delta / 60_000));
  if (mins < 60) return { kind: "mins", n: mins };
  const startDay = new Date(ms);
  startDay.setHours(0, 0, 0, 0);
  const nowDay = new Date(nowMs);
  nowDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startDay.getTime() - nowDay.getTime()) / 86_400_000);
  if (dayDiff === 1) return { kind: "tomorrow" };
  if (dayDiff >= 2) return { kind: "days", n: dayDiff };
  const hours = Math.max(1, Math.round(delta / 3_600_000));
  return { kind: "hours", n: hours };
}

export function formatAfficheCountdown(
  iso: string | null | undefined,
  localeSoon: string,
  nowMs = Date.now(),
): string | null {
  const c = afficheCountdown(iso, nowMs);
  if (c.kind === "none") return null;
  const soon = localeSoon.toUpperCase();
  if (c.kind === "started") return soon;
  if (c.kind === "tomorrow") return `${soon} • DEMAIN`;
  if (c.kind === "mins") return `${soon} • DANS ${c.n} MIN`;
  if (c.kind === "hours") return `${soon} • DANS ${c.n} H`;
  return `${soon} • DANS ${c.n} JOUR${c.n > 1 ? "S" : ""}`;
}
