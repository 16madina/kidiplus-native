// Catalogue des lenses/filtres — aligné sur kidiplus.com.
// Snap lenses are loaded dynamically from the Lens Group; local styles are fallback UI.

export type LensCategory = "beauty" | "fun" | "style" | "background" | "snap" | "none";

export type Lens = {
  lensId: string;
  groupId: string;
  name: string;
  icon: string;
  iconUrl?: string;
  category: LensCategory;
  /** RN tint overlay when Snap AR is unavailable (local style only). */
  tint?: string;
  /** true = vraie lens AR Snap. */
  isSnapLens?: boolean;
};

export const SNAP_DEMO_LENS_GROUP_ID = "5b22f85d-3308-452f-8bcc-058a5c9dc34b";

export const NONE_LENS: Lens = {
  lensId: "none",
  groupId: SNAP_DEMO_LENS_GROUP_ID,
  name: "Aucun",
  icon: "🚫",
  category: "none",
  tint: "transparent",
};

/** Local style fallbacks when the native Camera Kit module is not linked yet. */
export const STYLE_LENSES: Lens[] = [
  NONE_LENS,
  {
    lensId: "style-glow",
    groupId: SNAP_DEMO_LENS_GROUP_ID,
    name: "Glow",
    icon: "🌟",
    category: "beauty",
    tint: "rgba(255,230,180,0.22)",
  },
  {
    lensId: "style-warm",
    groupId: SNAP_DEMO_LENS_GROUP_ID,
    name: "Chaud",
    icon: "🔥",
    category: "style",
    tint: "rgba(255,140,60,0.24)",
  },
  {
    lensId: "style-studio",
    groupId: SNAP_DEMO_LENS_GROUP_ID,
    name: "Studio",
    icon: "📸",
    category: "style",
    tint: "rgba(90,130,255,0.16)",
  },
  {
    lensId: "style-rose",
    groupId: SNAP_DEMO_LENS_GROUP_ID,
    name: "Rose",
    icon: "✨",
    category: "beauty",
    tint: "rgba(255,90,150,0.18)",
  },
  {
    lensId: "style-noir",
    groupId: SNAP_DEMO_LENS_GROUP_ID,
    name: "Noir",
    icon: "🎬",
    category: "style",
    tint: "rgba(0,0,0,0.32)",
  },
];

export const LENSES = STYLE_LENSES;
