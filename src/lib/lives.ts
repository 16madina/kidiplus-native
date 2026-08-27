import { type Category, type LiveStream } from "../mock/lives";
import { supabase } from "./supabase";
import { resolveAvatarUrl, resolveStoredImage } from "./storage";
import { minutesUntil } from "./time";
import { normalizeCurrency } from "./money";

const LIVE_SELECT = `
  id, seller_id, title, category, cover_url, room_name, viewer_count, started_at, currency,
  seller:profiles!lives_seller_id_fkey(display_name, handle, avatar_url)
`;

const SCHEDULED_SELECT = `
  id, seller_id, title, category, cover_url, scheduled_at, currency, status,
  seller:profiles!lives_seller_id_fkey(display_name, handle, avatar_url)
`;

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=70";

type SellerEmbed = {
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
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
    startedAt: row.started_at ?? undefined,
    scheduled,
    startsInMin: scheduled ? minutesUntil(row.scheduled_at) : undefined,
    fictitious: false,
  };
}

export async function fetchActiveLives(limit = 60): Promise<LiveStream[]> {
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
  return Promise.all((data as unknown as LiveRow[]).map((row) => rowToStream(row, true)));
}
