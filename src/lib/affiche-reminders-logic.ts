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

export function formatAfficheWhen(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const date = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}
