import type { MockOrder } from "../mock/account";
import { formatMoney, normalizeCurrency, type Currency } from "./money";
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
  delivery_fee: number | null;
  total: number | null;
  currency: string | null;
  status: OrderStatus;
  fulfillment_status: FulfillmentStatus | null;
  payment_deadline: string | null;
  kind: string | null;
  created_at: string;
  seller_id: string;
  buyer_id: string;
  seller?: ProfileEmbed | ProfileEmbed[] | null;
  buyer?: ProfileEmbed | ProfileEmbed[] | null;
};

/** UI order row: display strings + raw fields for actions. */
export type OrderView = MockOrder & {
  rawStatus: OrderStatus;
  fulfillment: FulfillmentStatus | null;
  total: number;
  itemAmount: number;
  deliveryFee: number;
  currency: Currency;
  kind: "auction" | "fixed";
  paymentDeadline: string | null;
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

async function toOrderView(row: OrderRow, counterparty: string): Promise<OrderView> {
  const image =
    (await resolveStoredImage("shop-products", row.item_image, ["live-products", "live-covers"])) ?? "";
  const currency = normalizeCurrency(row.currency);
  const total = Number(row.total ?? row.amount ?? 0);
  return {
    id: row.id,
    name: row.item_name,
    seller: counterparty,
    price: formatMoney(total, currency),
    image,
    status: mapOrderUiStatus(row),
    when: formatRelative(row.created_at),
    rawStatus: row.status,
    fulfillment: row.fulfillment_status,
    total,
    itemAmount: Number(row.amount ?? 0),
    deliveryFee: Number(row.delivery_fee ?? 0),
    currency,
    kind: row.kind === "auction" ? "auction" : "fixed",
    paymentDeadline: row.payment_deadline,
  };
}

const ORDER_SELECT = `
  id, item_name, item_image, amount, delivery_fee, total, currency, status, fulfillment_status,
  payment_deadline, kind, created_at, seller_id, buyer_id,
  seller:profiles!orders_seller_id_fkey(display_name, handle),
  buyer:profiles!orders_buyer_id_fkey(display_name, handle)
`;

export async function fetchOrderById(orderId: string): Promise<OrderView | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as OrderRow;
  return toOrderView(row, embedName(row.seller, "Vendeur"));
}

export async function fetchMyPurchases(buyerId: string, limit = 50): Promise<OrderView[]> {
  // Opportunistic cleanup so pending orders past the deadline show cancelled.
  await supabase.rpc("expire_overdue_orders", {} as never).then(
    () => undefined,
    () => undefined,
  );
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return Promise.all(
    (data as unknown as OrderRow[]).map((row) => toOrderView(row, embedName(row.seller, "Vendeur"))),
  );
}

export async function fetchMySales(sellerId: string, limit = 100): Promise<OrderView[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return Promise.all(
    (data as unknown as OrderRow[]).map((row) => toOrderView(row, embedName(row.buyer, "Acheteur"))),
  );
}

// ---------------------------------------------------------------------------
// Lifecycle actions (same RPCs as kidiplus.com)
// ---------------------------------------------------------------------------

type RpcResult = { ok: boolean; error?: string };

async function lifecycleRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as { ok?: boolean; error?: string };
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "generic" };
}

/** Seller: mark the paid order as shipped (notifies the buyer). */
export function markOrderShipped(orderId: string): Promise<RpcResult> {
  return lifecycleRpc("mark_order_shipped", { _order_id: orderId });
}

/** Buyer: confirm delivery — releases seller escrow. */
export function confirmOrderDelivered(orderId: string): Promise<RpcResult> {
  return lifecycleRpc("confirm_order_delivered", { _order_id: orderId });
}

/** Buyer: open a dispute (escrow frozen until an admin decides). */
export function disputeOrder(
  orderId: string,
  reason: "inappropriate" | "fraud" | "counterfeit" | "harassment" | "other" = "other",
  note?: string,
): Promise<RpcResult> {
  return lifecycleRpc("dispute_order", { _order_id: orderId, _reason: reason, _note: note ?? null });
}
