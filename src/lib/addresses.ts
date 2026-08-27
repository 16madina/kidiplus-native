import { countryName, normalizeCountryCode as resolveCountryCode } from "./countries";
import { supabase } from "./supabase";

export type AddressRow = {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  country: string;
  city: string;
  zone_or_commune: string | null;
  street_address: string | null;
  postal_code: string | null;
  region: string | null;
  details: string | null;
  is_default: boolean;
};

export type AddressInput = {
  label?: string;
  full_name: string;
  phone: string;
  country?: string;
  city: string;
  zone_or_commune?: string | null;
  street_address?: string | null;
  postal_code?: string | null;
  region?: string | null;
  details?: string | null;
  is_default?: boolean;
};

export function normalizeCountryCode(input: string | null | undefined): string {
  return resolveCountryCode(input) ?? "CI";
}

export function countryLabel(code: string, locale?: string): string {
  return countryName(code, locale) || code;
}

export function formatAddressLine(row: AddressRow): string {
  return (
    [row.street_address, row.zone_or_commune, row.details].filter(Boolean).join(" · ") ||
    row.city
  );
}

export function formatAddressCity(row: AddressRow): string {
  const bits = [row.postal_code, row.city, countryLabel(row.country)].filter(Boolean);
  return bits.join(" ");
}

export async function fetchMyAddresses(userId: string): Promise<AddressRow[]> {
  const { data, error } = await supabase
    .from("addresses")
    .select(
      "id, user_id, label, full_name, phone, country, city, zone_or_commune, street_address, postal_code, region, details, is_default",
    )
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as AddressRow[];
}

/** Buyer's default shipping address (or first saved), used for live bid/buy gate. */
export async function fetchDefaultAddress(userId: string): Promise<AddressRow | null> {
  const rows = await fetchMyAddresses(userId);
  return rows.find((r) => r.is_default) ?? rows[0] ?? null;
}

export async function createAddress(
  userId: string,
  input: AddressInput,
): Promise<{ ok: true; address: AddressRow } | { ok: false; error: string }> {
  let makeDefault = !!input.is_default;
  if (!makeDefault) {
    const { count } = await supabase
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    makeDefault = (count ?? 0) === 0;
  }
  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: userId,
      label: input.label ?? "",
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      country: input.country ?? "",
      city: input.city.trim(),
      zone_or_commune: (input.zone_or_commune ?? "").trim() || null,
      street_address: (input.street_address ?? "").trim() || null,
      postal_code: (input.postal_code ?? "").trim() || null,
      region: (input.region ?? "").trim() || null,
      details: (input.details ?? "").trim() || null,
      is_default: makeDefault,
    })
    .select(
      "id, user_id, label, full_name, phone, country, city, zone_or_commune, street_address, postal_code, region, details, is_default",
    )
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, address: data as AddressRow };
}

export async function updateAddress(
  addressId: string,
  patch: Partial<AddressInput>,
): Promise<{ ok: true; address: AddressRow } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.full_name !== undefined) row.full_name = patch.full_name.trim();
  if (patch.phone !== undefined) row.phone = patch.phone.trim();
  if (patch.country !== undefined) row.country = patch.country;
  if (patch.city !== undefined) row.city = patch.city.trim();
  if (patch.zone_or_commune !== undefined) row.zone_or_commune = (patch.zone_or_commune ?? "").trim() || null;
  if (patch.street_address !== undefined) row.street_address = (patch.street_address ?? "").trim() || null;
  if (patch.postal_code !== undefined) row.postal_code = (patch.postal_code ?? "").trim() || null;
  if (patch.region !== undefined) row.region = (patch.region ?? "").trim() || null;
  if (patch.details !== undefined) row.details = (patch.details ?? "").trim() || null;
  if (patch.is_default !== undefined) row.is_default = !!patch.is_default;
  const { data, error } = await supabase
    .from("addresses")
    .update(row)
    .eq("id", addressId)
    .select(
      "id, user_id, label, full_name, phone, country, city, zone_or_commune, street_address, postal_code, region, details, is_default",
    )
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "update failed" };
  return { ok: true, address: data as AddressRow };
}

export async function setDefaultAddress(addressId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", addressId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteAddress(
  addressId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("address_id", addressId);
  if ((count ?? 0) > 0) return { ok: false, error: "address_in_use" };
  const { error } = await supabase.from("addresses").delete().eq("id", addressId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
