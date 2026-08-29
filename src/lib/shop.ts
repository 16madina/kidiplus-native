import type { ShopItem } from "../mock/account";
import { formatMoney, normalizeCurrency } from "./money";
import { assertImageSize, type PickedImage } from "./pick-image";
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
  sellerId: string;
  price: string;
  image: string;
};

export type ShopProductInput = {
  name: string;
  description?: string | null;
  imagePaths?: string[];
  price: number;
  currency: string;
  stock: number;
};

function firstImage(row: ShopProductRow): string | null {
  if (Array.isArray(row.images) && typeof row.images[0] === "string") return row.images[0];
  return row.image_url;
}

export function formatShopError(err: unknown): string {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null) {
    const o = err as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown };
    const msg = [o.message, o.error, o.details, o.hint]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean)
      .join(" — ");
    if (msg) return msg;
  }
  return "Erreur inconnue";
}

export async function toShopItem(row: ShopProductRow): Promise<ShopItem> {
  const imagePath = firstImage(row);
  const image = (await resolveStoredImage("shop-products", imagePath)) ?? "";
  const currency = normalizeCurrency(row.currency);
  const priceValue = Number(row.price) || 0;
  return {
    id: row.id,
    name: row.name,
    price: formatMoney(priceValue, currency),
    stock: Number(row.stock) || 0,
    kind: "fixed",
    image,
    active: !!row.active,
    priceValue,
    currency,
    description: row.description,
    imagePath,
    imagePaths: Array.isArray(row.images)
      ? (row.images as unknown[]).filter((x): x is string => typeof x === "string")
      : imagePath
        ? [imagePath]
        : [],
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

export async function listSellerActiveShopProducts(sellerId: string): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from("shop_products")
    .select("id, seller_id, name, description, image_url, images, price, currency, stock, active")
    .eq("seller_id", sellerId)
    .eq("active", true)
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
        const sellerRaw = (
          row as {
            seller?: { display_name?: string; handle?: string } | Array<{ display_name?: string; handle?: string }>;
          }
        ).seller;
        const sellerObj = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;
        const seller = sellerObj?.display_name?.trim() || sellerObj?.handle || "Vendeur";
        return {
          id: item.id,
          name: item.name,
          seller,
          sellerId: row.seller_id,
          price: item.price,
          image: item.image,
        };
      },
    ),
  );
}

export async function uploadShopProductImage(userId: string, picked: PickedImage): Promise<string> {
  assertImageSize(picked.blob);
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${userId}/${rand}.${picked.ext}`;
  const { error } = await supabase.storage.from("shop-products").upload(path, picked.blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: picked.contentType || undefined,
  });
  if (error) throw new Error(formatShopError(error));
  return path;
}

export async function createShopProduct(sellerId: string, input: ShopProductInput): Promise<ShopItem> {
  const images = (input.imagePaths ?? []).slice(0, 5);
  const cover = images[0] ?? null;
  const { data, error } = await supabase
    .from("shop_products")
    .insert({
      seller_id: sellerId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      image_url: cover,
      images,
      price: input.price,
      currency: input.currency,
      stock: input.stock,
      active: true,
    })
    .select("id, seller_id, name, description, image_url, images, price, currency, stock, active")
    .single();
  if (error || !data) throw new Error(formatShopError(error) || "insert failed");
  return toShopItem(data as ShopProductRow);
}

export async function updateShopProduct(
  id: string,
  patch: Partial<ShopProductInput> & { active?: boolean },
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name.trim();
  if (patch.description !== undefined) dbPatch.description = patch.description?.trim() || null;
  if (patch.price !== undefined) dbPatch.price = patch.price;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;
  if (patch.stock !== undefined) dbPatch.stock = patch.stock;
  if (patch.active !== undefined) dbPatch.active = patch.active;
  if (patch.imagePaths !== undefined) {
    const images = patch.imagePaths.slice(0, 5);
    dbPatch.images = images;
    dbPatch.image_url = images[0] ?? null;
  }
  const { error } = await supabase.from("shop_products").update(dbPatch).eq("id", id);
  if (error) throw new Error(formatShopError(error));
}

export async function archiveShopProduct(id: string): Promise<void> {
  await updateShopProduct(id, { active: false });
}

export async function reactivateShopProduct(id: string): Promise<void> {
  await updateShopProduct(id, { active: true });
}
