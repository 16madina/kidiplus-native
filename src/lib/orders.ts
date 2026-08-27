import type { MockOrder } from "../mock/account";
import { formatMoney, normalizeCurrency } from "./money";
import { resolveStoredImage } from "./storage";
import { supabase } from "./supabase";
import { formatRelative } from "./time";

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";
export type FulfillmentStatus = "awaiting" | "shipped" | "delivered" | "disputed";

type ProfileEmbed = { display_name?: string | null; handle?: string | null };

type OrderRow = {
  id: string;
  item_name: string;
  item_image: string | null;
  amount: number | null;
  total: number | null;
  currency: string | null;
  status: OrderStatus;
  fulfillment_status: FulfillmentStatus | null;
  created_at: string;
  seller_id: string;
  buyer_id: string;
  seller?: ProfileEmbed | ProfileEmbed[] | null;
  buyer?: ProfileEmbed | ProfileEmbed[] | null;
};

function embedName(value: ProfileEmbed | ProfileEmbed[] | null | undefined, fallback: string): string {
  const p = Array.isArray(value) ? value[0] : value;
  return p?.display_name?.trim() || p?.handle || fallback;
}

export function mapOrderUiStatus(row: Pick<OrderRow, "status" | "fulfillment_status">): MockOrder["status"] {
  if (row.status === "pending") return "awaitingPayment";
  if (row.status === "failed") return "failed";
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "refunded") return "refunded";
  if (row.fulfillment_status === "delivered") return "delivered";
  if (row.fulfillment_status === "shipped") return "shipped";
  return "paid";
}

async function toMockOrder(row: OrderRow, counterparty: string): Promise<MockOrder> {
  const image =
    (await resolveStoredImage("shop-products", row.item_image, ["live-products", "live-covers"])) ?? "";
  const amount = Number(row.total ?? row.amount ?? 0);
  return {
    id: row.id,
    name: row.item_name,
    seller: counterparty,
    price: formatMoney(amount, normalizeCurrency(row.currency)),
    image,
    status: mapOrderUiStatus(row),
    when: formatRelative(row.created_at),
  };
}

const ORDER_SELECT = `
  id, item_name, item_image, amount, total, currency, status, fulfillment_status, created_at, seller_id, buyer_id,
  seller:profiles!orders_seller_id_fkey(display_name, handle),
  buyer:profiles!orders_buyer_id_fkey(display_name, handle)
`;

export async function fetchMyPurchases(buyerId: string, limit = 50): Promise<MockOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return Promise.all(
    (data as OrderRow[]).map((row) => toMockOrder(row, embedName(row.seller, "Vendeur"))),
  );
}

export async function fetchMySales(sellerId: string, limit = 100): Promise<MockOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return Promise.all(
    (data as OrderRow[]).map((row) => toMockOrder(row, embedName(row.buyer, "Acheteur"))),
  );
}
