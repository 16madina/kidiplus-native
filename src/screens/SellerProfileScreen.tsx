import { ShopScreen } from "./ShopScreen";

/** Public seller profile = same surface as « Ma boutique » (checklist E). */
export function SellerProfileScreen({ sellerId }: { sellerId: string }) {
  return <ShopScreen sellerId={sellerId} />;
}
