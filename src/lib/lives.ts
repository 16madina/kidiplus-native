import { type Category, type LiveStream } from "../mock/lives";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { resolveAvatarUrl, resolveStoredImage } from "./storage";
import { minutesUntil } from "./time";
import { normalizeCurrency } from "./money";
import { HOST_ABSENT_EXPIRE_MINUTES, HOST_ABSENT_WARN_MINUTES, isAbandonedLive } from "./host-absent";
import type { OpenLiveRow } from "./open-live";

export type { OpenLiveRow } from "./open-live";

const LIVE_SELECT = `
  id, seller_id, title, category, cover_url, room_name, viewer_count, started_at, currency,
  seller:profiles!lives_seller_id_fkey(display_name, handle, avatar_url, is_verified, is_referred)
`;

const SCHEDULED_SELECT = `
  id, seller_id, title, category, cover_url, scheduled_at, currency, status,
  seller:profiles!lives_seller_id_fkey(display_name, handle, avatar_url, is_verified, is_referred)
`;

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=70";

const CANCELLED_IDS_KEY = "kidiplus.cancelledScheduledLives";

async function loadCancelledLiveIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(CANCELLED_IDS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export async function rememberCancelledLive(liveId: string): Promise<void> {
  const ids = await loadCancelledLiveIds();
  ids.add(liveId);
  await AsyncStorage.setItem(CANCELLED_IDS_KEY, JSON.stringify([...ids]));
}

type SellerEmbed = {
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
  is_referred?: boolean | null;
};

type LiveRow = {
  id: string;
  seller_id: string;
  title: string;
  category: string | null;
  cover_url: string | null;
  room_name?: string | null;
  viewer_count?: number | null;
  started_at?: string | null;
  scheduled_at?: string | null;
  currency: string | null;
  seller: SellerEmbed | SellerEmbed[] | null;
};

const CATEGORIES: Array<Exclude<Category, "For You">> = [
  "Beauty",
  "Sneakers",
  "Fashion",
  "Cards",
  "Electronics",
  "Jewelry",
  "Bags",
  "Perfumes",
  "Watches",
  "Games",
  "Home",
  "Bundles",
];

const CATEGORY_ALIASES: Record<string, Exclude<Category, "For You">> = {
  beauty: "Beauty",
  beauté: "Beauty",
  sneakers: "Sneakers",
  fashion: "Fashion",
  mode: "Fashion",
  cards: "Cards",
  electronics: "Electronics",
  électronique: "Electronics",
  jewelry: "Jewelry",
  bijoux: "Jewelry",
  bags: "Bags",
  "bags & accessories": "Bags",
  "sacs & accessoires": "Bags",
  perfumes: "Perfumes",
  parfums: "Perfumes",
  watches: "Watches",
  games: "Games",
  home: "Home",
  bundles: "Bundles",
};

function normalizeCategory(raw: string | null | undefined): Exclude<Category, "For You"> {
  if (!raw) return "Fashion";
  const trimmed = raw.trim();
  if ((CATEGORIES as string[]).includes(trimmed)) return trimmed as Exclude<Category, "For You">;
  return CATEGORY_ALIASES[trimmed.toLowerCase()] ?? "Fashion";
}

function sellerOf(row: LiveRow): SellerEmbed {
  const s = row.seller;
  if (Array.isArray(s)) return s[0] ?? {};
  return s ?? {};
}

async function rowToStream(row: LiveRow, scheduled = false): Promise<LiveStream> {
  const seller = sellerOf(row);
  const sellerName = seller.display_name?.trim() || seller.handle || "Vendeur";
  const avatar = await resolveAvatarUrl(seller.avatar_url ?? null);
  const cover = await resolveStoredImage("live-covers", row.cover_url, [
    "live-products",
    "shop-products",
    "avatars",
    "demo-covers",
  ]);
  const cur = normalizeCurrency(row.currency);
  return {
    id: `db-${row.id}`,
    seller: sellerName,
    avatar,
    title: row.title,
    thumbnail: cover || avatar || FALLBACK_COVER,
    viewers: Math.max(0, row.viewer_count || 0),
    category: normalizeCategory(row.category),
    roomName: row.room_name ?? undefined,
    liveId: row.id,
    sellerId: row.seller_id,
    handle: seller.handle ?? undefined,
    currency: cur,
    startedAt: scheduled
      ? (row.scheduled_at ?? row.started_at ?? undefined)
      : (row.started_at ?? undefined),
    scheduled,
    startsInMin: scheduled ? minutesUntil(row.scheduled_at) : undefined,
    fictitious: false,
    isVerified: !!seller.is_verified,
    isReferred: !!seller.is_referred,
  };
}

export async function fetchActiveLives(limit = 60): Promise<LiveStream[]> {
  void notifyAbsentHostLivesInDb().catch(() => 0);
  void expireAbandonedLivesInDb(null).catch(() => 0);
  const { data, error } = await supabase
    .from("lives")
    .select(LIVE_SELECT)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return Promise.all((data as unknown as LiveRow[]).map((row) => rowToStream(row, false)));
}

export async function fetchUpcomingScheduledLives(limit = 20): Promise<LiveStream[]> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("lives")
    .select(SCHEDULED_SELECT)
    .eq("status", "scheduled")
    .gt("scheduled_at", cutoff)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  const hidden = await loadCancelledLiveIds();
  const rows = (data as unknown as LiveRow[]).filter((row) => !hidden.has(row.id));
  return Promise.all(rows.map((row) => rowToStream(row, true)));
}

export async function countSellerLives(sellerId: string): Promise<number> {
  const { count } = await supabase.from("lives").select("id", { count: "exact", head: true }).eq("seller_id", sellerId);
  return count ?? 0;
}

export type SellerLiveEntry = {
  id: string;
  title: string;
  status: string;
  cover_url: string | null;
  started_at: string | null;
  scheduled_at: string | null;
  ended_at: string | null;
  viewer_count: number | null;
  replay_url: string | null;
  replay_status: string | null;
  replay_expires_at: string | null;
};

export async function fetchSellerLives(sellerId: string, limit = 40): Promise<SellerLiveEntry[]> {
  const { data } = await supabase
    .from("lives")
    .select(
      "id, title, status, cover_url, started_at, scheduled_at, ended_at, viewer_count, replay_url, replay_status, replay_expires_at",
    )
    .eq("seller_id", sellerId)
    .order("ended_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  const rows = (data as SellerLiveEntry[] | null) ?? [];
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      cover_url: (await resolveStoredImage("live-covers", r.cover_url)) ?? r.cover_url,
    })),
  );
}

export type ScheduledLiveRow = {
  id: string;
  seller_id: string;
  title: string;
  category: string | null;
  cover_url: string | null;
  scheduled_at: string | null;
  status: string;
};

export async function fetchMyScheduledLives(sellerId: string): Promise<ScheduledLiveRow[]> {
  const { data } = await supabase
    .from("lives")
    .select("id, seller_id, title, category, cover_url, scheduled_at, status")
    .eq("seller_id", sellerId)
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true });
  const rows = (data as ScheduledLiveRow[] | null) ?? [];
  const hidden = await loadCancelledLiveIds();
  const visible = rows.filter((r) => !hidden.has(r.id));
  return Promise.all(
    visible.map(async (r) => ({
      ...r,
      cover_url: (await resolveStoredImage("live-covers", r.cover_url)) ?? r.cover_url,
    })),
  );
}

export async function cancelScheduledLiveInDb(liveId: string, sellerId?: string): Promise<void> {
  const rpcNames = ["cancel_scheduled_live", "cancel_live", "delete_scheduled_live"];
  for (const fn of rpcNames) {
    const { data, error } = await supabase.rpc(fn, { _live_id: liveId } as never);
    if (error) continue;
    const r = data as { ok?: boolean } | boolean | null;
    if (r === true || (r && typeof r === "object" && r.ok !== false)) {
      await rememberCancelledLive(liveId);
      return;
    }
  }

  const statuses = ["cancelled", "canceled", "ended"];
  for (const status of statuses) {
    let q = supabase.from("lives").update({ status }).eq("id", liveId);
    if (sellerId) q = q.eq("seller_id", sellerId);
    const { data, error } = await q.select("id");
    if (!error && (data?.length ?? 0) > 0) {
      await rememberCancelledLive(liveId);
      return;
    }
  }

  let del = supabase.from("lives").delete().eq("id", liveId);
  if (sellerId) del = del.eq("seller_id", sellerId);
  const { data: deleted, error: delErr } = await del.select("id");
  if (!delErr && (deleted?.length ?? 0) > 0) {
    await rememberCancelledLive(liveId);
    return;
  }

  // RLS is blocking writes. Hide locally so the live disappears on this
  // device; fetches also skip remembered ids.
  await rememberCancelledLive(liveId);
}

export async function uploadLiveCover(userId: string, picked: { blob: Blob; ext: string; contentType: string }): Promise<string> {
  const rand = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/${rand}.${picked.ext}`;
  const { error } = await supabase.storage.from("live-covers").upload(path, picked.blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: picked.contentType || undefined,
  });
  if (error) throw error;
  return path;
}

/** Upload a local live overlay (poster / fond) and return a signed https URL viewers can load. */
export async function uploadLiveOverlayImage(userId: string, uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const mime = blob.type && blob.type !== "application/octet-stream" ? blob.type : "image/jpeg";
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const path = await uploadLiveCover(userId, { blob, ext, contentType: mime });
  const url = await resolveStoredImage("live-covers", path);
  if (!url) throw new Error("overlay_upload_failed");
  return url;
}

export async function uploadLiveProductImage(
  userId: string,
  picked: { blob: Blob; ext: string; contentType: string },
): Promise<string> {
  const rand = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/${rand}.${picked.ext}`;
  const { error } = await supabase.storage.from("live-products").upload(path, picked.blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: picked.contentType || undefined,
  });
  if (error) throw error;
  return path;
}

export async function createLiveInDb(input: {
  sellerId: string;
  title: string;
  category: string;
  coverPath: string | null;
  roomName: string;
  currency?: string;
  products: Array<{
    name: string;
    imagePath: string | null;
    mode: "auction" | "fixed";
    price: number;
    stock: number;
    shopProductId?: string;
    timerSeconds?: number;
  }>;
}): Promise<string> {
  const { data: live, error } = await supabase
    .from("lives")
    .insert({
      seller_id: input.sellerId,
      title: input.title,
      category: input.category,
      cover_url: input.coverPath,
      room_name: input.roomName,
      status: "live",
      started_at: new Date().toISOString(),
      host_last_seen_at: new Date().toISOString(),
      broadcast_mode: "camera",
      ...(input.currency ? { currency: input.currency } : {}),
    })
    .select("id")
    .single();
  if (error || !live) throw error ?? new Error("Impossible de créer le live");
  if (input.products.length > 0) {
    const rows = input.products.map((p, i) => ({
      live_id: live.id,
      name: p.name,
      image_url: p.imagePath,
      mode: p.mode,
      start_price: p.price,
      price: p.price,
      stock: p.stock,
      timer_seconds: p.timerSeconds ?? 45,
      status: "upcoming",
      position: i,
      ...(p.shopProductId ? { shop_product_id: p.shopProductId } : {}),
    }));
    const { error: pErr } = await supabase.from("live_products").insert(rows);
    if (pErr) throw pErr;
  }
  return live.id as string;
}

export async function endLiveInDb(liveId: string): Promise<{ ok: boolean; error?: string }> {
  const endedAt = new Date().toISOString();
  const { error } = await supabase
    .from("lives")
    .update({ status: "ended", ended_at: endedAt, ingress_id: null })
    .eq("id", liveId)
    .eq("status", "live");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markLiveActiveInDb(liveId: string): Promise<void> {
  await supabase
    .from("lives")
    .update({
      ended_at: null,
      host_last_seen_at: new Date().toISOString(),
    })
    .eq("id", liveId)
    .eq("status", "live");
}

export async function touchLiveHostInDb(liveId: string): Promise<void> {
  const { error } = await supabase.rpc("touch_live_host", { _live_id: liveId });
  if (error) {
    await supabase
      .from("lives")
      .update({ host_last_seen_at: new Date().toISOString() })
      .eq("id", liveId)
      .eq("status", "live");
  }
}

const OPEN_LIVE_SELECT =
  "id, title, started_at, room_name, cover_url, category, currency, host_last_seen_at, broadcast_mode, ingress_id, allow_gifts";

/** Currently-open lives for this seller (reconnect banner). */
export async function findOpenLives(sellerId: string): Promise<OpenLiveRow[]> {
  const { data } = await supabase
    .from("lives")
    .select(OPEN_LIVE_SELECT)
    .eq("seller_id", sellerId)
    .eq("status", "live")
    .order("started_at", { ascending: false });
  return ((data ?? []) as OpenLiveRow[]).filter((r) => r.started_at !== null);
}

/** End seller lives with no host heartbeat for `_maxAgeMinutes` (default 5). */
export async function expireAbandonedLivesInDb(
  sellerId?: string | null,
  maxAgeMinutes = HOST_ABSENT_EXPIRE_MINUTES,
): Promise<number> {
  const { data, error } = await supabase.rpc("expire_abandoned_lives", {
    _seller_id: sellerId ?? null,
    _max_age_minutes: maxAgeMinutes,
  });
  if (!error) {
    const r = (data ?? {}) as { expired?: number };
    return Number(r.expired ?? 0);
  }

  if (!sellerId) return 0;
  const open = await findOpenLives(sellerId);
  const stale = open.filter((r) => isAbandonedLive(r, maxAgeMinutes));
  await Promise.all(stale.map((r) => endLiveInDb(r.id)));
  return stale.length;
}

/** Warn hosts absent ~2 min via push (remaining minutes before the 5 min close). */
export async function notifyAbsentHostLivesInDb(
  warnAfterMinutes = HOST_ABSENT_WARN_MINUTES,
  maxAgeMinutes = HOST_ABSENT_EXPIRE_MINUTES,
): Promise<number> {
  const { data, error } = await supabase.rpc("notify_absent_host_lives", {
    _warn_after_minutes: warnAfterMinutes,
    _max_age_minutes: maxAgeMinutes,
  });
  if (error) return 0;
  const r = (data ?? {}) as { notified?: number };
  return Number(r.notified ?? 0);
}

export async function createScheduledLiveInDb(input: {
  sellerId: string;
  title: string;
  category: string;
  coverPath: string | null;
  scheduledAt: string;
  description?: string | null;
  estimatedDurationMin?: number;
  allowBids?: boolean;
  allowBuyNow?: boolean;
  notifyFollowers?: boolean;
  allowGifts?: boolean;
  currency?: string;
  products: Array<{
    name: string;
    imagePath: string | null;
    mode: "auction" | "fixed";
    price: number;
    stock: number;
    shopProductId?: string;
    timerSeconds?: number;
  }>;
}): Promise<string> {
  const roomName = `kidi-${input.sellerId.slice(0, 8)}-${Date.now()}`;
  const { data: live, error } = await supabase
    .from("lives")
    .insert({
      seller_id: input.sellerId,
      title: input.title,
      category: input.category,
      cover_url: input.coverPath,
      room_name: roomName,
      status: "scheduled",
      scheduled_at: input.scheduledAt,
      broadcast_mode: "camera",
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.estimatedDurationMin !== undefined ? { estimated_duration_min: input.estimatedDurationMin } : {}),
      ...(typeof input.allowBids === "boolean" ? { allow_bids: input.allowBids } : {}),
      ...(typeof input.allowBuyNow === "boolean" ? { allow_buy_now: input.allowBuyNow } : {}),
      ...(typeof input.notifyFollowers === "boolean" ? { notify_followers: input.notifyFollowers } : {}),
      ...(typeof input.allowGifts === "boolean" ? { allow_gifts: input.allowGifts } : {}),
    })
    .select("id")
    .single();
  if (error || !live) throw error ?? new Error("schedule failed");
  if (input.products.length > 0) {
    const rows = input.products.map((p, i) => ({
      live_id: live.id,
      name: p.name,
      image_url: p.imagePath,
      mode: p.mode,
      start_price: p.price,
      price: p.price,
      stock: p.stock,
      timer_seconds: p.timerSeconds ?? 45,
      status: "upcoming",
      position: i,
      ...(p.shopProductId ? { shop_product_id: p.shopProductId } : {}),
    }));
    const { error: pErr } = await supabase.from("live_products").insert(rows);
    if (pErr) throw pErr;
  }
  return live.id as string;
}

export function isReplayPlayable(row: SellerLiveEntry): boolean {
  if (row.replay_status !== "ready" || !row.replay_url) return false;
  if (!row.replay_expires_at) return true;
  return Date.parse(row.replay_expires_at) > Date.now();
}

/** Fetch a single live stream by id (used for push deep-links). */
export async function fetchLiveById(id: string): Promise<LiveStream | null> {
  if (!id) return null;
  const bare = id.startsWith("db-") ? id.slice(3) : id;
  const { data, error } = await supabase
    .from("lives")
    .select(LIVE_SELECT)
    .eq("id", bare)
    .maybeSingle();
  if (error || !data) return null;
  return rowToStream(data as unknown as LiveRow, false);
}
