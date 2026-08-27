import i18n from "../i18n";

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const min = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (min < 1) return i18n.t("time.now");
  if (min < 60) return i18n.t("time.minuteAgo", { count: min });
  const hours = Math.round(min / 60);
  if (hours < 24) return i18n.t("time.hourAgo", { count: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return i18n.t("time.dayAgo", { count: days });
  const weeks = Math.round(days / 7);
  if (weeks < 5) return i18n.t("time.weekAgo", { count: weeks });
  const months = Math.round(days / 30);
  if (months < 12) return i18n.t("time.monthAgo", { count: months });
  return i18n.t("time.yearAgo", { count: Math.round(days / 365) });
}

export function minutesUntil(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return undefined;
  return Math.max(0, Math.round((then - Date.now()) / 60_000));
}
