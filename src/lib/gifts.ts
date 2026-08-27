// Virtual gift catalog — MUST stay in sync with the server `_gift_price` SQL.
// Clients only send `gift_key`; prices are resolved server-side.

import { supabase } from "./supabase";
import { normalizeCurrency, type Currency } from "./money";

export type GiftKey =
  | "rose" | "heart" | "butterfly" | "star" | "diamond" | "crown" | "rocket" | "lion" | "kidi";

export type GiftDef = {
  key: GiftKey;
  emoji: string;
  nameKey: string;
  tier: 1 | 2 | 3;
  prices: Record<Currency, number>;
};

export const GIFT_CATALOG: GiftDef[] = [
  { key: "rose", emoji: "🌹", nameKey: "gifts.name.rose", tier: 1, prices: { XOF: 100, EUR: 0.5, CAD: 1, USD: 0.5, GBP: 0.5 } },
  { key: "heart", emoji: "💛", nameKey: "gifts.name.heart", tier: 1, prices: { XOF: 250, EUR: 1, CAD: 1.5, USD: 1, GBP: 1 } },
  { key: "butterfly", emoji: "🦋", nameKey: "gifts.name.butterfly", tier: 2, prices: { XOF: 500, EUR: 2, CAD: 3, USD: 2, GBP: 2 } },
  { key: "diamond", emoji: "💎", nameKey: "gifts.name.diamond", tier: 2, prices: { XOF: 500, EUR: 2, CAD: 3, USD: 2, GBP: 2 } },
  { key: "star", emoji: "⭐", nameKey: "gifts.name.star", tier: 2, prices: { XOF: 1000, EUR: 4, CAD: 6, USD: 4, GBP: 4 } },
  { key: "crown", emoji: "👑", nameKey: "gifts.name.crown", tier: 2, prices: { XOF: 1000, EUR: 4, CAD: 6, USD: 4, GBP: 4 } },
  { key: "rocket", emoji: "🚀", nameKey: "gifts.name.rocket", tier: 3, prices: { XOF: 2500, EUR: 8, CAD: 12, USD: 8, GBP: 8 } },
  { key: "kidi", emoji: "🎁", nameKey: "gifts.name.kidi", tier: 3, prices: { XOF: 5000, EUR: 10, CAD: 15, USD: 10, GBP: 10 } },
  { key: "lion", emoji: "🦁", nameKey: "gifts.name.lion", tier: 3, prices: { XOF: 5000, EUR: 15, CAD: 22, USD: 15, GBP: 15 } },
];

export function giftByKey(key: string): GiftDef | null {
  return GIFT_CATALOG.find((g) => g.key === key) ?? null;
}

export function giftPrice(key: GiftKey, currency: string | null | undefined): number {
  const cur = normalizeCurrency(currency);
  return giftByKey(key)?.prices[cur] ?? 0;
}

export type SendGiftResult =
  | { ok: true; giftId: string; senderName: string }
  | { ok: false; error: string };

export async function sendGift(liveId: string, giftKey: GiftKey): Promise<SendGiftResult> {
  const { data, error } = await supabase.rpc("send_gift", {
    _live_id: liveId,
    _gift_key: giftKey,
  } as never);
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as { ok?: boolean; error?: string; gift_id?: string; sender_name?: string };
  return r.ok
    ? { ok: true, giftId: String(r.gift_id), senderName: String(r.sender_name ?? "") }
    : { ok: false, error: r.error ?? "unknown" };
}
