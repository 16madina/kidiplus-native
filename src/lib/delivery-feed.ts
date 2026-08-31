// Soft-rank lives so sellers who ship to the viewer’s country come first.
// Same rules as `canDeliver` (country only). Bid/buy stay blocked client+server.

import { fetchDefaultAddress } from "./addresses";
import { canDeliver, type SellerDeliverySettings } from "./delivery";
import { normalizeCountryCode } from "./countries";
import { supabase } from "./supabase";
import type { LiveStream } from "../mock/lives";
import { mergeDeliveryFlags, prioritizeDeliverable } from "./delivery-feed-logic";

export type DeliveryFlagRow = { seller_id: string; delivers_to_me: boolean };

export { mergeDeliveryFlags, prioritizeDeliverable } from "./delivery-feed-logic";

export async function resolveViewerCountry(userId: string | null | undefined, profileCountry?: string | null): Promise<string | null> {
  if (!userId) return normalizeCountryCode(profileCountry);
  const addr = await fetchDefaultAddress(userId);
  return normalizeCountryCode(addr?.country) ?? normalizeCountryCode(profileCountry);
}

export async function fetchDeliveryFlags(
  sellerIds: string[],
  country: string | null,
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const ids = [...new Set(sellerIds.filter((id) => id && !id.startsWith("fictitious:")))];
  const iso = normalizeCountryCode(country);
  if (!iso || ids.length === 0) return out;

  const rpc = await supabase.rpc("sellers_deliver_to_country", {
    _seller_ids: ids,
    _country: iso,
  } as never);
  if (!rpc.error && Array.isArray(rpc.data)) {
    for (const row of rpc.data as DeliveryFlagRow[]) {
      if (row?.seller_id) out.set(String(row.seller_id), !!row.delivers_to_me);
    }
    const missing = ids.filter((id) => !out.has(id));
    if (missing.length === 0) return out;
    const extra = await fetchDeliveryFlagsClient(missing, iso);
    extra.forEach((v, k) => out.set(k, v));
    return out;
  }

  return fetchDeliveryFlagsClient(ids, iso);
}

async function fetchDeliveryFlagsClient(ids: string[], country: string): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const [{ data: settingsRows }, { data: profiles }] = await Promise.all([
    supabase
      .from("seller_delivery_settings")
      .select("seller_id, mode, zones, flat_fee")
      .in("seller_id", ids),
    supabase.from("profiles").select("id, country").in("id", ids),
  ]);
  const settingsById = new Map<string, SellerDeliverySettings>();
  for (const row of (settingsRows ?? []) as Array<Record<string, unknown>>) {
    const sid = String(row.seller_id ?? "");
    if (!sid) continue;
    settingsById.set(sid, {
      seller_id: sid,
      mode: (row.mode as SellerDeliverySettings["mode"]) ?? "flat",
      flat_fee: Number(row.flat_fee ?? 0),
      zones: Array.isArray(row.zones) ? (row.zones as SellerDeliverySettings["zones"]) : [],
      updated_at: "",
    });
  }
  const countryById = new Map<string, string | null>();
  for (const p of (profiles ?? []) as Array<{ id: string; country?: string | null }>) {
    countryById.set(p.id, p.country ?? null);
  }
  for (const id of ids) {
    const gate = canDeliver({
      settings: settingsById.get(id) ?? null,
      sellerCountry: countryById.get(id),
      buyerCountry: country,
    });
    out.set(id, gate.eligible);
  }
  return out;
}

export async function annotateLivesForCountry(
  lives: LiveStream[],
  country: string | null,
): Promise<LiveStream[]> {
  if (!country) return lives.map((l) => ({ ...l, deliversToMe: undefined }));
  const flags = await fetchDeliveryFlags(
    lives.map((l) => l.sellerId).filter((id): id is string => !!id),
    country,
  );
  return prioritizeDeliverable(mergeDeliveryFlags(lives, flags));
}
