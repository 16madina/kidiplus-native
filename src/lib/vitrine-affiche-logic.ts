export const AFFICHE_FONTS = ["system", "serif", "rounded", "mono"] as const;
export type AfficheFont = (typeof AFFICHE_FONTS)[number];

export const AFFICHE_COLORS = [
  "#FFFFFF",
  "#10162B",
  "#E8B93B",
  "#EF4444",
  "#EC4899",
  "#7C3AED",
  "#0EA5E9",
  "#22C55E",
] as const;

export type AfficheTextLayer = {
  id: string;
  kind: "text";
  text: string;
  x: number;
  y: number;
  scale: number;
  color: string;
  font: AfficheFont;
};

export type AfficheImageLayer = {
  id: string;
  kind: "image";
  uri: string;
  x: number;
  y: number;
  scale: number;
};

export type AfficheLayer = AfficheTextLayer | AfficheImageLayer;

export type AfficheLayout = {
  kidiAffiche: true;
  title: string;
  backgroundColor: string;
  backgroundUri: string | null;
  /** ISO datetime of the event / drop — used for « Me rappeler ». */
  eventAt: string | null;
  layers: AfficheLayer[];
};

export function defaultAfficheEventAt(fromMs = Date.now()): string {
  const d = new Date(fromMs);
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

export function parseAfficheEventAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function splitAfficheEventAt(iso: string | null | undefined): { date: string; time: string } {
  const ms = iso ? new Date(iso).getTime() : NaN;
  const d = Number.isFinite(ms) ? new Date(ms) : new Date(defaultAfficheEventAt());
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function joinAfficheEventAt(date: string, time: string): string | null {
  const raw = `${date.trim()}T${time.trim() || "18:00"}`;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function newAfficheLayout(): AfficheLayout {
  return {
    kidiAffiche: true,
    title: "",
    backgroundColor: "#10162B",
    backgroundUri: null,
    eventAt: defaultAfficheEventAt(),
    layers: [
      {
        id: "title",
        kind: "text",
        text: "Mon affiche",
        x: 0.5,
        y: 0.22,
        scale: 1,
        color: "#FFFFFF",
        font: "system",
      },
    ],
  };
}

export function encodeAfficheCaption(layout: AfficheLayout): string {
  return JSON.stringify({ ...layout, kidiAffiche: true });
}

export function parseAfficheCaption(caption: string | null | undefined): AfficheLayout | null {
  if (!caption?.includes("kidiAffiche")) return null;
  try {
    const raw = JSON.parse(caption) as Partial<AfficheLayout>;
    if (!raw || raw.kidiAffiche !== true) return null;
    return {
      kidiAffiche: true,
      title: typeof raw.title === "string" ? raw.title : "",
      backgroundColor: typeof raw.backgroundColor === "string" ? raw.backgroundColor : "#10162B",
      backgroundUri: typeof raw.backgroundUri === "string" ? raw.backgroundUri : null,
      eventAt: parseAfficheEventAt(raw.eventAt),
      layers: Array.isArray(raw.layers) ? (raw.layers as AfficheLayer[]) : [],
    };
  } catch {
    return null;
  }
}

export function afficheFontFamily(font: AfficheFont): string | undefined {
  if (font === "serif") return "Georgia";
  if (font === "rounded") return "Avenir Next";
  if (font === "mono") return "Menlo";
  return undefined;
}
