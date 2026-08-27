// Seller delivery settings — same table/RPCs as kidiplus.com.

import { supabase } from "./supabase";
import { normalizeCountryCode } from "./countries";

export type DeliveryMode = "zones" | "flat" | "courier";

export type DeliveryZone = {
  country: string; // ISO-2 upper. Empty allowed for legacy rows.
  name: string;
  fee: number;
};

export type SellerDeliverySettings = {
  seller_id: string;
  mode: DeliveryMode;
  flat_fee: number;
  zones: DeliveryZone[];
  updated_at: string;
};

export const DEFAULT_DELIVERY_SETTINGS: Omit<SellerDeliverySettings, "seller_id" | "updated_at"> = {
  mode: "flat",
  flat_fee: 0,
  zones: [],
};

function normalizeZones(z: unknown): DeliveryZone[] {
  if (!Array.isArray(z)) return [];
  return z
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const raw = String((x as { country?: unknown }).country ?? "").trim();
      const iso = normalizeCountryCode(raw) ?? raw.toUpperCase();
      return {
        country: iso,
        name: String((x as { name?: unknown }).name ?? "").trim(),
        fee: Number((x as { fee?: unknown }).fee ?? 0),
      };
    })
    .filter((x) => x.name.length > 0 && Number.isFinite(x.fee) && x.fee >= 0);
}

function coerce(row: Record<string, unknown> | null | undefined, sellerId: string): SellerDeliverySettings {
  return {
    seller_id: String(row?.seller_id ?? sellerId),
    mode: ((row?.mode as DeliveryMode) ?? DEFAULT_DELIVERY_SETTINGS.mode),
    flat_fee: Number(row?.flat_fee ?? 0),
    zones: normalizeZones(row?.zones),
    updated_at: String(row?.updated_at ?? new Date().toISOString()),
  };
}

export type EligibilityResult = {
  eligible: boolean;
  reason?: "no_address" | "no_country_coverage" | "courier_country_mismatch";
};

/** Same gate as kidiplus.com — blocks bid/buy when delivery is impossible. */
export function canDeliver(args: {
  settings: SellerDeliverySettings | null;
  sellerCountry?: string | null;
  buyerCountry?: string | null;
}): EligibilityResult {
  const buyer = normalizeCountryCode(args.buyerCountry) ?? (args.buyerCountry ?? "").trim().toUpperCase();
  if (!buyer) return { eligible: false, reason: "no_address" };

  const settings = args.settings;
  if (!settings || settings.mode === "flat") return { eligible: true };

  if (settings.mode === "courier") {
    const seller = normalizeCountryCode(args.sellerCountry) ?? (args.sellerCountry ?? "").trim().toUpperCase();
    if (!seller) return { eligible: true };
    return buyer === seller
      ? { eligible: true }
      : { eligible: false, reason: "courier_country_mismatch" };
  }

  const zones = Array.isArray(settings.zones) ? settings.zones : [];
  if (zones.length === 0) return { eligible: true };
  const hit = zones.some((z) => {
    const zc = normalizeCountryCode(z.country) ?? z.country.trim().toUpperCase();
    return zc === buyer;
  });
  return hit ? { eligible: true } : { eligible: false, reason: "no_country_coverage" };
}

export async function fetchDeliverySettings(sellerId: string): Promise<SellerDeliverySettings | null> {
  const { data, error } = await supabase.rpc("get_seller_delivery_settings", {
    _seller_id: sellerId,
  } as never);
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return coerce(row as Record<string, unknown>, sellerId);
}

export async function fetchDeliverySettingsOrDefault(sellerId: string): Promise<SellerDeliverySettings> {
  const s = await fetchDeliverySettings(sellerId);
  if (s) return s;
  return { seller_id: sellerId, ...DEFAULT_DELIVERY_SETTINGS, updated_at: new Date().toISOString() };
}

export async function upsertDeliverySettings(
  sellerId: string,
  patch: { mode: DeliveryMode; flat_fee?: number; zones?: DeliveryZone[] },
): Promise<{ ok: true; settings: SellerDeliverySettings } | { ok: false; error: string }> {
  const zones = normalizeZones(patch.zones ?? []);
  const flat_fee = Number(patch.flat_fee ?? 0);
  const mode = patch.mode;
  const updated_at = new Date().toISOString();

  // Prefer SECURITY DEFINER RPC (reliable under RLS).
  const { data: rpcData, error: rpcErr } = await supabase.rpc("upsert_seller_delivery_settings", {
    _mode: mode,
    _flat_fee: flat_fee,
    _zones: zones,
  } as never);
  if (!rpcErr && rpcData) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row) {
      const verified = await fetchDeliverySettings(sellerId);
      return { ok: true, settings: verified ?? coerce(row as Record<string, unknown>, sellerId) };
    }
  }

  // Fallback: direct table write (owner RLS).
  const payload = { seller_id: sellerId, mode, flat_fee, zones, updated_at };
  const { data: updated, error: upErr } = await supabase
    .from("seller_delivery_settings")
    .update({ mode, flat_fee, zones, updated_at })
    .eq("seller_id", sellerId)
    .select("*")
    .maybeSingle();
  if (upErr) return { ok: false, error: upErr.message };
  if (updated) return { ok: true, settings: coerce(updated as Record<string, unknown>, sellerId) };

  const { data: inserted, error: inErr } = await supabase
    .from("seller_delivery_settings")
    .insert(payload)
    .select("*")
    .maybeSingle();
  if (inErr) return { ok: false, error: rpcErr?.message || inErr.message };
  return { ok: true, settings: coerce((inserted ?? payload) as Record<string, unknown>, sellerId) };
}
