import { resolveAvatarUrl, resolveStoredImage } from "./storage";
import { supabase } from "./supabase";
import { storyExpiresAt } from "./vitrine-story-logic";

export {
  STORY_IMAGE_MS,
  STORY_TTL_MS,
  filterBlockedStories,
  isStoryVideoUrl,
  storiesHiddenByFeedIndex,
  storyExpiresAt,
} from "./vitrine-story-logic";

export type VitrineStory = {
  id: string;
  userId: string;
  mediaUrl: string;
  posterUrl: string | null;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  createdAt: string;
  expiresAt: string;
  unread: boolean;
};

type SellerEmbed = {
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
};

type StoryRow = {
  id: string;
  user_id: string;
  media_url: string;
  poster_url: string | null;
  expires_at: string;
  created_at: string;
  seller: SellerEmbed | SellerEmbed[] | null;
};

function sellerOf(raw: StoryRow["seller"]): SellerEmbed {
  if (Array.isArray(raw)) return raw[0] ?? {};
  return raw ?? {};
}

async function mapRow(row: StoryRow): Promise<VitrineStory | null> {
  const mediaUrl = await resolveStoredImage("vitrine-media", row.media_url, [
    "shop-products",
    "live-covers",
    "live-products",
  ]);
  if (!mediaUrl) return null;
  const seller = sellerOf(row.seller);
  const posterUrl = row.poster_url
    ? await resolveStoredImage("vitrine-media", row.poster_url, ["shop-products", "live-covers"])
    : null;
  return {
    id: row.id,
    userId: row.user_id,
    mediaUrl,
    posterUrl,
    displayName: seller.display_name?.trim() || seller.handle || "Vendeur",
    handle: (seller.handle ?? "").replace(/^@/, ""),
    avatarUrl: (await resolveAvatarUrl(seller.avatar_url ?? null)) || null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    unread: true,
  };
}

export async function fetchVitrineStories(limit = 30): Promise<VitrineStory[]> {
  const { data, error } = await supabase
    .from("vitrine_stories")
    .select(
      `
      id, user_id, media_url, poster_url, expires_at, created_at,
      seller:profiles!vitrine_stories_user_id_fkey(display_name, handle, avatar_url)
    `,
    )
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const mapped = await Promise.all((data as unknown as StoryRow[]).map(mapRow));
  return mapped.filter((s): s is VitrineStory => !!s);
}

export async function createVitrineStory(
  mediaUrl: string,
  posterUrl?: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: "unauthorized" };
  if (!mediaUrl) return { ok: false, error: "no_media" };
  const { data, error } = await supabase
    .from("vitrine_stories")
    .insert({
      user_id: uid,
      media_url: mediaUrl,
      poster_url: posterUrl ?? null,
      expires_at: storyExpiresAt(),
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "insert_failed" };
  return { ok: true, id: data.id as string };
}

export async function deleteVitrineStory(id: string): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return false;
  const { error } = await supabase.from("vitrine_stories").delete().eq("id", id).eq("user_id", uid);
  return !error;
}
