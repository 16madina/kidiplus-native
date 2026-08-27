import type { PickedImage } from "./pick-image";

export type LiveSaleKind = "auction" | "fixed";

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
};

export function newDraftId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
