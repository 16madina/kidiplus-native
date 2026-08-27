export const BROADCAST_CATEGORY_KEYS = [
  "Beauty",
  "Fashion",
  "Bags",
  "Perfumes",
  "Jewelry",
  "Watches",
  "Electronics",
  "Sneakers",
  "Home",
  "Other",
] as const;

export type BroadcastCategoryKey = (typeof BROADCAST_CATEGORY_KEYS)[number];

export const BROADCAST_CATEGORY_FR: Record<BroadcastCategoryKey, string> = {
  Beauty: "Beauté",
  Fashion: "Mode",
  Bags: "Sacs",
  Perfumes: "Parfums",
  Jewelry: "Bijoux",
  Watches: "Montres",
  Electronics: "Électronique",
  Sneakers: "Sneakers",
  Home: "Maison",
  Other: "Autre",
};
