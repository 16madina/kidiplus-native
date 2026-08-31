import type { PickedImage } from "./pick-image";

export type LiveSaleKind = "auction" | "fixed";

export const AUCTION_TIMER_PRESETS = [
  { sec: 45, label: "45 s" },
  { sec: 60, label: "1 min" },
  { sec: 120, label: "2 min" },
  { sec: 180, label: "3 min" },
] as const;

export type LiveDraftProduct = {
  id: string;
  name: string;
  image?: string;
  picked?: PickedImage | null;
  extraPicked?: Array<PickedImage | null>;
  imagePath?: string | null;
  shopProductId?: string;
  mode: LiveSaleKind;
  startPrice: number;
  price: number;
  timerSec: number;
  stock: number;
  bidIncrement?: number | null;
  description?: string;
  brand?: string | null;
  condition?: import("./live-product-options").ProductCondition | null;
  colors?: string[];
  sizes?: string[];
};

export function newDraftId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
