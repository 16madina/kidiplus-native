import type { ShopItem } from "../mock/account";
import { formatMoney, normalizeCurrency } from "./money";
import { resolveStoredImage } from "./storage";
import { supabase } from "./supabase";

export type ShopProductRow = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  images?: unknown;
  price: number;
  currency: string;
  stock: number;
  active: boolean;
};

export type ShopSearchHit = {
  id: string;
  name: string;
  seller: string;
  price: string;
  image: string;
};

function firstImage(row: ShopProductRow): string | null {
  if (Array.isArray(row.images) && typeof row.images[0] === "string") return row.images[0];
  return row.image_url;
}

export async function toShopItem(row: ShopProductRow): Promise<ShopItem> {
  const image = (await resolveStoredImage("shop-products", firstImage(row))) ?? "";
  return {
    id: row.id,
    name: row.name,
    price: formatMoney(Number(row.price), normalizeCurrency(row.currency)),
    stock: Number(row.stock) || 0,
    kind: "fixed",
    image,
    active: !!row.active,
  };
}

export async function listMyShopProducts(userId: string): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from("shop_products")
    .select("id, seller_id, name, description, image_url, images, price, currency, stock, active")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return Promise.all((data as ShopProductRow[]).map(toShopItem));
}

export async function searchActiveShopProducts(query: string, limit = 40): Promise<ShopSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const q = `%${trimmed}%`;
  const { data, error } = await supabase
    .from("shop_products")
    .select(
      `id, seller_id, name, description, image_url, images, price, currency, stock, active,
       seller:profiles!shop_products_seller_id_fkey(display_name, handle, avatar_url)`,
    )
    .eq("active", true)
    .ilike("name", q)
    .limit(limit);
  if (error || !data) return [];
  return Promise.all(
    (data as Array<ShopProductRow & { seller?: { display_name?: string; handle?: string } | null }>).map(
      async (row) => {
        const item = await toShopItem(row);
        const sellerRaw = (row as { seller?: { display_name?: string; handle?: string } | Array<{ display_name?: string; handle?: string }> }).seller;
        const sellerObj = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;
        const seller = sellerObj?.display_name?.trim() || sellerObj?.handle || "Vendeur";
        return { id: item.id, name: item.name, seller, price: item.price, image: item.image };
      },
    ),
  );
}
