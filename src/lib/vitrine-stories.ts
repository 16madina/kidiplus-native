import { parseStoryPosterClip, type VideoClip } from "./publish-media";
import { MUSIC_COLUMNS, musicFromRow, musicToRow, type VitrineMusic } from "./vitrine-music";
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
  clip: VideoClip | null;
  music: VitrineMusic | null;
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
  music_url?: string | null;
  music_title?: string | null;
  music_artist?: string | null;
  music_start_sec?: number | string | null;
  music_volume?: number | string | null;
  original_volume?: number | string | null;
};

const STORY_SELECT = `
  id, user_id, media_url, poster_url, expires_at, created_at, ${MUSIC_COLUMNS},
  seller:profiles!vitrine_stories_user_id_fkey(display_name, handle, avatar_url)
`;

function sellerOf(raw: StoryRow["seller"]): SellerEmbed {
  if (Array.isArray(raw)) return raw[0] ?? {};
  return raw ?? {};
}

async function fetchStoryRows(limit: number): Promise<StoryRow[]> {
  const now = new Date().toISOString();
  const withSeller = await supabase
    .from("vitrine_stories")
    .select(STORY_SELECT)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!withSeller.error && withSeller.data) return withSeller.data as unknown as StoryRow[];

  const plain = await supabase
    .from("vitrine_stories")
    .select("id, user_id, media_url, poster_url, expires_at, created_at")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (plain.error || !plain.data) return [];
  const rows = plain.data as unknown as StoryRow[];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  if (ids.length === 0) return rows;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_url")
    .in("id", ids);
  const byId = new Map(
    (profiles ?? []).map((p) => [(p as { id: string }).id, p as SellerEmbed & { id: string }]),
  );
  return rows.map((row) => ({
    ...row,
    seller: row.user_id ? byId.get(row.user_id) ?? null : null,
  }));
}

async function mapRow(row: StoryRow): Promise<VitrineStory | null> {
  const resolved = await resolveStoredImage("vitrine-media", row.media_url, [
    "shop-products",
    "live-covers",
    "live-products",
  ]);
  const mediaUrl = resolved || (row.media_url?.startsWith("http") ? row.media_url : null);
  if (!mediaUrl) return null;
  const seller = sellerOf(row.seller);
  const storedPoster = parseStoryPosterClip(row.poster_url);
  const posterResolved = storedPoster.posterUrl
    ? await resolveStoredImage("vitrine-media", storedPoster.posterUrl, ["shop-products", "live-covers"])
    : null;
  return {
    id: row.id,
    userId: row.user_id,
    mediaUrl,
    posterUrl: posterResolved,
    displayName: seller.display_name?.trim() || seller.handle || "Vendeur",
    handle: (seller.handle ?? "").replace(/^@/, ""),
    avatarUrl: (await resolveAvatarUrl(seller.avatar_url ?? null)) || null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    unread: true,
    clip: storedPoster.clip,
    music: musicFromRow(row),
  };
}

export async function fetchVitrineStories(limit = 30): Promise<VitrineStory[]> {
  const data = await fetchStoryRows(limit);
  if (data.length === 0) return [];
  const mapped = await Promise.all(data.map(mapRow));
  return mapped.filter((s): s is VitrineStory => !!s);
}

export async function createVitrineStory(
  mediaUrl: string,
  posterUrl?: string | null,
  music?: VitrineMusic | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: "unauthorized" };
  if (!mediaUrl) return { ok: false, error: "no_media" };
  const payload = {
    user_id: uid,
    media_url: mediaUrl,
    poster_url: posterUrl ?? null,
    expires_at: storyExpiresAt(),
    ...musicToRow(music),
  };
  let { data, error } = await supabase.from("vitrine_stories").insert(payload as never).select("id").maybeSingle();
  if (error && payload.poster_url) {
    const retry = await supabase
      .from("vitrine_stories")
      .insert({ ...payload, poster_url: null } as never)
      .select("id")
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data) return { ok: false, error: error?.message || "insert_failed" };
  return { ok: true, id: data.id as string };
}

export async function deleteVitrineStory(id: string): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return false;
  const { error } = await supabase.from("vitrine_stories").delete().eq("id", id).eq("user_id", uid);
  return !error;
}
