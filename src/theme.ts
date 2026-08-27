export const NAVY = "#10162B";
export const NAVY_950 = "#080C1A";
export const NAVY_900 = "#0C1122";
export const NAVY_800 = "#10162B";
export const NAVY_700 = "#141B33";
export const NAVY_600 = "#1C2440";
export const NAVY_INSET = "#182140";
export const WELCOME_BG = "#0B1436";

export const GOLD = "#E8B93B";
export const GOLD_BRIGHT = "#F5C34A";
export const GOLD_WELCOME = "#F5C34A";
export const GOLD_GO_LIVE = "#E4B438";
export const GOLD_GUEST = "#D4AF37";
export const GOLD_GRADIENT = ["#F7CE5A", "#F5C34A", "#D9A73A"] as const;
export const GOLD_BTN = ["#E8C86A", "#D4AF37", "#B8912C"] as const;

export const LIVE_RED = "#E5393F";
export const LIVE_GRADIENT = ["#E24B4B", "#C62828"] as const;
export const GUEST_CREAM = "#FBF6EC";

export const RADIUS = 14;
export const TAB_BAR_HEIGHT = 72;
export const LIVE_BADGE = 60;

export const light = {
  background: "#FFFFFF",
  foreground: NAVY,
  card: "#FFFFFF",
  muted: "#F2F3F7",
  mutedForeground: "#6B7289",
  border: "#E6E8EF",
  accent: GOLD,
  accentForeground: NAVY,
  live: LIVE_RED,
};

export const dark = {
  background: NAVY_900,
  foreground: "#F7F8FC",
  card: NAVY_700,
  muted: NAVY_600,
  mutedForeground: "#A8B0C4",
  border: "rgba(255,255,255,0.10)",
  accent: "#E8C45A",
  accentForeground: NAVY_900,
  live: "#E85A4A",
};

export type ThemeColors = typeof light;

export function formatViewers(n: number): string {
  return n.toLocaleString("fr-FR").replace(/\u202F/g, "\u00A0");
}

export function formatMin(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h} h ${min}` : `${h} h`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] || "?").toUpperCase();
  return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase();
}
