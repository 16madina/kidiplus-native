import { resolveAvatarUrl, resolveStoredImage } from "./storage";
import { supabase } from "./supabase";

export type VitrineMediaType = "image" | "video" | "carousel";

export type VitrineFeedPost = {
  id: string;
  userId: string | null;
  mediaType: VitrineMediaType;
  mediaUrls: string[];
  posterUrl: string | null;
  caption: string;
  productId: string | null;
  liveId: string | null;
  likes: number;
  comments: number;
  likedByMe: boolean;
  sellerName: string;
  handle: string;
  avatarUrl: string | null;
};

type SellerEmbed = {
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
};

type VitrineRow = {
  id: string;
  user_id: string | null;
  media_type: string | null;
  media_urls: unknown;
  poster_url: string | null;
  caption: string | null;
  product_id: string | null;
  live_id: string | null;
  like_count: number | null;
  comment_count: number | null;
  seller: SellerEmbed | SellerEmbed[] | null;
};

const POST_SELECT = `
  id, user_id, media_type, media_urls, poster_url, caption, product_id, live_id,
  like_count, comment_count, created_at, active,
  seller:profiles!vitrine_posts_user_id_fkey(display_name, handle, avatar_url, is_verified)
`;

function sellerOf(raw: VitrineRow["seller"]): SellerEmbed {
  if (Array.isArray(raw)) return raw[0] ?? {};
  return raw ?? {};
}

function normalizeMediaUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
      }
    } catch {
      /* plain URL */
    }
    return [trimmed];
  }
  return [];
}

export function looksLikeVideo(url: string, mediaType?: string | null): boolean {
  if (mediaType === "video") return true;
  return /\.(mp4|mov|webm|m4v|m3u8)(\?|$)/i.test(url);
}

async function resolveMediaUrl(value: string): Promise<string | null> {
  return resolveStoredImage("vitrine-media", value, ["shop-products", "live-covers", "live-products"]);
}

async function mapRow(row: VitrineRow, likedIds: Set<string>): Promise<VitrineFeedPost | null> {
  const mediaUrls = (
    await Promise.all(normalizeMediaUrls(row.media_urls).map((url) => resolveMediaUrl(url)))
  ).filter((u): u is string => !!u);
  if (mediaUrls.length === 0 && !row.live_id) return null;
  const seller = sellerOf(row.seller);
  const sellerName = seller.display_name?.trim() || seller.handle || "Vendeur";
  const handle = seller.handle?.replace(/^@/, "") || "kidi";
  const avatarUrl = (await resolveAvatarUrl(seller.avatar_url ?? null)) || null;
  const posterUrl = row.poster_url ? await resolveMediaUrl(row.poster_url) : null;
  const mediaType = (row.media_type === "video" || row.media_type === "carousel" ? row.media_type : "image") as VitrineMediaType;
  return {
    id: row.id,
    userId: row.user_id,
    mediaType,
    mediaUrls,
    posterUrl,
    caption: row.caption?.trim() || "",
    productId: row.product_id,
    liveId: row.live_id,
    likes: Number(row.like_count ?? 0),
    comments: Number(row.comment_count ?? 0),
    likedByMe: likedIds.has(row.id),
    sellerName,
    handle,
    avatarUrl,
  };
}

async function fetchPostRows(limit: number): Promise<VitrineRow[]> {
  const withSeller = await supabase
    .from("vitrine_posts")
    .select(POST_SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!withSeller.error && withSeller.data) return withSeller.data as unknown as VitrineRow[];

  const plain = await supabase
    .from("vitrine_posts")
    .select(
      "id, user_id, media_type, media_urls, poster_url, caption, product_id, live_id, like_count, comment_count, created_at, active",
    )
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (plain.error || !plain.data) return [];
  const rows = plain.data as unknown as VitrineRow[];
  const ids = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))];
  if (ids.length === 0) return rows;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_url")
    .in("id", ids);
  const byId = new Map(
    (profiles ?? []).map((p) => [
      (p as { id: string }).id,
      p as SellerEmbed & { id: string },
    ]),
  );
  return rows.map((row) => ({
    ...row,
    seller: row.user_id ? byId.get(row.user_id) ?? null : null,
  }));
}

export async function fetchVitrinePosts(limit = 30): Promise<VitrineFeedPost[]> {
  const data = await fetchPostRows(limit);
  if (data.length === 0) return [];

  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  const likedIds = new Set<string>();
  if (uid) {
    const { data: likes } = await supabase
      .from("vitrine_likes")
      .select("post_id")
      .eq("user_id", uid)
      .in(
        "post_id",
        data.map((r) => r.id),
      );
    for (const like of likes ?? []) {
      if (like && typeof (like as { post_id?: string }).post_id === "string") {
        likedIds.add((like as { post_id: string }).post_id);
      }
    }
  }

  const mapped = await Promise.all(data.map((row) => mapRow(row, likedIds)));
  return mapped.filter((p): p is VitrineFeedPost => !!p);
}

export async function countVitrinePostsByUser(userId: string): Promise<number> {
  if (!userId) return 0;
  const { count } = await supabase
    .from("vitrine_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("active", true);
  return count ?? 0;
}

export async function fetchVitrinePostsByUser(userId: string, limit = 40): Promise<VitrineFeedPost[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("vitrine_posts")
    .select(
      "id, user_id, media_type, media_urls, poster_url, caption, product_id, live_id, like_count, comment_count, created_at, active",
    )
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const mapped = await Promise.all((data as unknown as VitrineRow[]).map((row) => mapRow(row, new Set())));
  return mapped.filter((p): p is VitrineFeedPost => !!p);
}
