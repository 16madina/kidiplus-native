import type { PickedImage } from "./pick-image";
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
  const isAffiche = typeof row.caption === "string" && row.caption.includes("kidiAffiche");
  if (mediaUrls.length === 0 && !row.live_id && !isAffiche) return null;
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

async function fetchPostRows(limit: number, offset = 0): Promise<VitrineRow[]> {
  const to = offset + Math.max(1, limit) - 1;
  const withSeller = await supabase
    .from("vitrine_posts")
    .select(POST_SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .range(offset, to);
  if (!withSeller.error && withSeller.data) return withSeller.data as unknown as VitrineRow[];

  const plain = await supabase
    .from("vitrine_posts")
    .select(
      "id, user_id, media_type, media_urls, poster_url, caption, product_id, live_id, like_count, comment_count, created_at, active",
    )
    .eq("active", true)
    .order("created_at", { ascending: false })
    .range(offset, to);
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

export async function fetchVitrinePosts(limit = 12, offset = 0): Promise<VitrineFeedPost[]> {
  const data = await fetchPostRows(limit, offset);
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

export async function fetchVitrinePostById(postId: string): Promise<VitrineFeedPost | null> {
  if (!postId) return null;
  const withSeller = await supabase
    .from("vitrine_posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .maybeSingle();
  let row = (!withSeller.error && withSeller.data
    ? (withSeller.data as unknown as VitrineRow)
    : null);
  if (!row) {
    const plain = await supabase
      .from("vitrine_posts")
      .select(
        "id, user_id, media_type, media_urls, poster_url, caption, product_id, live_id, like_count, comment_count, created_at, active",
      )
      .eq("id", postId)
      .maybeSingle();
    if (plain.error || !plain.data) return null;
    row = plain.data as unknown as VitrineRow;
    if (row.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, handle, avatar_url")
        .eq("id", row.user_id)
        .maybeSingle();
      row = { ...row, seller: (prof as SellerEmbed | null) ?? null };
    }
  }
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  const likedIds = new Set<string>();
  if (uid) {
    const { data: like } = await supabase
      .from("vitrine_likes")
      .select("post_id")
      .eq("user_id", uid)
      .eq("post_id", postId)
      .maybeSingle();
    if (like) likedIds.add(postId);
  }
  return mapRow(row, likedIds);
}

export async function toggleVitrineLike(
  postId: string,
  currentlyLiked: boolean,
): Promise<{ ok: boolean; liked: boolean }> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, liked: currentlyLiked };
  try {
    if (currentlyLiked) {
      const { error } = await supabase
        .from("vitrine_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", uid);
      if (error) return { ok: false, liked: currentlyLiked };
      return { ok: true, liked: false };
    }
    const { error } = await supabase.from("vitrine_likes").insert({ post_id: postId, user_id: uid });
    if (error) return { ok: false, liked: currentlyLiked };
    return { ok: true, liked: true };
  } catch {
    return { ok: false, liked: currentlyLiked };
  }
}

export type VitrineComment = {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  authorName: string;
  authorAvatar: string | null;
};

export async function fetchVitrineComments(postId: string, limit = 40): Promise<VitrineComment[]> {
  if (!postId) return [];
  const { data, error } = await supabase
    .from("vitrine_comments")
    .select(
      `
      id, post_id, user_id, body, created_at, parent_id,
      author:profiles!vitrine_comments_user_id_fkey(display_name, handle, avatar_url)
      `,
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return Promise.all(
    (data as Array<{
      id: string;
      post_id: string;
      user_id: string;
      body: string;
      created_at: string;
      parent_id: string | null;
      author: SellerEmbed | SellerEmbed[] | null;
    }>).map(async (r) => {
      const author = Array.isArray(r.author) ? r.author[0] : r.author;
      return {
        id: r.id,
        postId: r.post_id,
        userId: r.user_id,
        body: r.body,
        createdAt: r.created_at,
        parentId: r.parent_id ?? null,
        authorName: author?.display_name?.trim() || author?.handle || "User",
        authorAvatar: (await resolveAvatarUrl(author?.avatar_url ?? null)) || null,
      };
    }),
  );
}

export async function addVitrineComment(
  postId: string,
  body: string,
  parentId?: string | null,
): Promise<{ ok: true; comment: VitrineComment } | { ok: false; error: string }> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: "unauthorized" };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  const { data, error } = await supabase
    .from("vitrine_comments")
    .insert({
      post_id: postId,
      user_id: uid,
      body: trimmed,
      parent_id: parentId ?? null,
    })
    .select("id, post_id, user_id, body, created_at, parent_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "failed" };
  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name, handle, avatar_url")
    .eq("id", uid)
    .maybeSingle();
  const author = prof as SellerEmbed | null;
  return {
    ok: true,
    comment: {
      id: data.id as string,
      postId: data.post_id as string,
      userId: data.user_id as string,
      body: data.body as string,
      createdAt: data.created_at as string,
      parentId: (data.parent_id as string | null) ?? null,
      authorName: author?.display_name?.trim() || author?.handle || "User",
      authorAvatar: (await resolveAvatarUrl(author?.avatar_url ?? null)) || null,
    },
  };
}

/** Upload image/video blob into the public vitrine-media bucket. Returns public URL. */
export async function uploadVitrineMedia(picked: PickedImage): Promise<string | null> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return null;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${uid}/${rand}.${picked.ext || "jpg"}`;
  const { error } = await supabase.storage.from("vitrine-media").upload(path, picked.blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: picked.contentType || undefined,
  });
  if (error) return null;
  const { data } = supabase.storage.from("vitrine-media").getPublicUrl(path);
  return data.publicUrl || null;
}

export async function createVitrinePost(input: {
  mediaUrls: string[];
  mediaType: VitrineMediaType;
  caption?: string;
  productId?: string | null;
  liveId?: string | null;
  posterUrl?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: "unauthorized" };
  if (input.mediaUrls.length === 0 && !input.liveId) {
    return { ok: false, error: "no_media" };
  }
  const { data, error } = await supabase
    .from("vitrine_posts")
    .insert({
      user_id: uid,
      media_type: input.mediaType,
      media_urls: input.mediaUrls,
      poster_url: input.posterUrl ?? null,
      caption: input.caption?.trim() || null,
      product_id: input.productId ?? null,
      live_id: input.liveId ?? null,
      active: true,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "failed" };
  return { ok: true, id: data.id as string };
}

function storagePathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/vitrine-media\/([^?]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

async function removeVitrineFiles(urls: (string | null | undefined)[]) {
  const paths = urls.map(storagePathFromPublicUrl).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try {
    await supabase.storage.from("vitrine-media").remove(paths);
  } catch {
    /* best-effort cleanup */
  }
}

/** Deletes the DB row and storage files. Soft-archives if hard delete is denied. */
export async function deleteVitrinePost(postId: string): Promise<boolean> {
  if (!postId || postId.startsWith("demo-")) return false;
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return false;
  const { data: row } = await supabase
    .from("vitrine_posts")
    .select("media_urls, poster_url")
    .eq("id", postId)
    .eq("user_id", uid)
    .maybeSingle();
  const { error } = await supabase.from("vitrine_posts").delete().eq("id", postId).eq("user_id", uid);
  if (!error) {
    const urls = Array.isArray(row?.media_urls) ? (row!.media_urls as string[]) : [];
    void removeVitrineFiles([...urls, row?.poster_url as string | null]);
    return true;
  }
  const { error: soft } = await supabase
    .from("vitrine_posts")
    .update({ active: false })
    .eq("id", postId)
    .eq("user_id", uid);
  return !soft;
}
