import type { LiveStream } from "../mock/lives";

/** Keep in sync with `BROADCAST_CATEGORY_FR` — labels shown on Explorer trends. */
const CATEGORY_FR: Record<string, string> = {
  Beauty: "Beauté",
  Fashion: "Mode",
  Bags: "Sacs & accessoires",
  Perfumes: "Parfums",
  Jewelry: "Bijoux",
  Watches: "Montres",
  Electronics: "Électronique",
  Sneakers: "Sneakers",
  Home: "Maison",
  Other: "Autre",
  Games: "Jeux vidéo",
  Bundles: "Déstockage & lots",
  Cards: "Cartes",
};

export type ExploreSearchTab = 0 | 1 | 2;

const FOLD: Record<string, string> = {
  à: "a",
  â: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  ï: "i",
  î: "i",
  ô: "o",
  ö: "o",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
};

export function foldExploreQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[àâäéèêëïîôöùûüç]/g, (ch) => FOLD[ch] ?? ch)
    .replace(/\s+/g, " ");
}

/** English DB keys a browse tile / typed category must match. */
const CATEGORY_QUERY_ALIASES: Record<string, string[]> = {
  beauty: ["Beauty"],
  beaute: ["Beauty"],
  fashion: ["Fashion"],
  mode: ["Fashion"],
  "mode femme": ["Fashion"],
  "mode homme": ["Fashion"],
  "women fashion": ["Fashion"],
  "men fashion": ["Fashion"],
  bags: ["Bags"],
  sacs: ["Bags"],
  "sacs & accessoires": ["Bags"],
  "sacs et accessoires": ["Bags"],
  accessoires: ["Bags"],
  perfumes: ["Perfumes"],
  parfums: ["Perfumes"],
  parfum: ["Perfumes"],
  jewelry: ["Jewelry"],
  bijoux: ["Jewelry"],
  watches: ["Watches"],
  montres: ["Watches"],
  montre: ["Watches"],
  electronics: ["Electronics"],
  electronique: ["Electronics"],
  sneakers: ["Sneakers"],
  home: ["Home"],
  maison: ["Home"],
  games: ["Games"],
  jeux: ["Games"],
  "jeux video": ["Games"],
  gaming: ["Games"],
  bundles: ["Bundles"],
  destockage: ["Bundles"],
  "destockage & lots": ["Bundles"],
  lots: ["Bundles"],
  other: ["Other"],
  autre: ["Other"],
  cards: ["Cards"],
};

const BROWSE_TILE_KEYS: Record<string, string[]> = {
  beaute: ["Beauty"],
  "mode-femme": ["Fashion"],
  "mode-homme": ["Fashion"],
  sacs: ["Bags"],
  parfums: ["Perfumes"],
  bijoux: ["Jewelry"],
  montres: ["Watches"],
  electronique: ["Electronics"],
  "jeux-video": ["Games"],
  sneakers: ["Sneakers"],
  maison: ["Home"],
  destockage: ["Bundles"],
};

export function browseTileCategoryKeys(tileId: string): string[] {
  return BROWSE_TILE_KEYS[tileId] ?? [];
}

/** First English key stored on `lives.category` for a browse tile. */
export function browseTileSearchQuery(tileId: string): string {
  return browseTileCategoryKeys(tileId)[0] ?? "Fashion";
}

export function resolveExploreCategoryKeys(query: string): string[] | null {
  const q = foldExploreQuery(query);
  if (!q) return null;
  if (CATEGORY_QUERY_ALIASES[q]) return CATEGORY_QUERY_ALIASES[q];
  const fromFr = Object.entries(CATEGORY_FR).find(([, label]) => foldExploreQuery(label) === q);
  if (fromFr) return [fromFr[0]];
  const rawKey = query.trim();
  if (rawKey in CATEGORY_FR) return [rawKey];
  return null;
}

export function liveMatchesExploreQuery(
  stream: Pick<LiveStream, "seller" | "title" | "category" | "handle">,
  query: string,
): boolean {
  const q = foldExploreQuery(query);
  if (!q) return false;
  if (foldExploreQuery(stream.seller).includes(q)) return true;
  if (foldExploreQuery(stream.title).includes(q)) return true;
  if (stream.handle && foldExploreQuery(stream.handle).includes(q)) return true;
  const keys = resolveExploreCategoryKeys(query);
  if (keys?.includes(stream.category)) return true;
  return foldExploreQuery(stream.category) === q;
}

export function exploreCategoryLabel(key: string): string {
  return CATEGORY_FR[key] ?? key;
}

/**
 * Like kidiplus.com: category → Lives.
 * Seller / boutique name → Vendeurs.
 * Product name only → Produits (boutique).
 */
export function pickExploreResultTab(input: {
  query: string;
  liveCount: number;
  sellerCount: number;
  productCount: number;
}): ExploreSearchTab {
  if (resolveExploreCategoryKeys(input.query)) return 0;
  if (input.sellerCount > 0) return 1;
  if (input.productCount > 0 && input.liveCount === 0) return 2;
  if (input.liveCount > 0) return 0;
  if (input.productCount > 0) return 2;
  return 0;
}
