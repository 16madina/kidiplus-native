import { resolveAvatarUrl } from "./storage";
import { supabase } from "./supabase";

export type SellerSearchHit = {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  followers: number;
  ratingAvg: number | null;
  ratingCount: number;
  isVerified: boolean;
  isReferred: boolean;
  live: boolean;
};

export async function searchSellers(query: string, limit = 30): Promise<SellerSearchHit[]> {
  const q = query.trim().replace(/^@/, "").replace(/[%_,()]/g, "").slice(0, 40);
  if (q.length < 1) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, handle, avatar_url, followers_count, rating_avg, rating_count, is_verified, is_referred, is_seller",
    )
    .eq("is_seller", true)
    .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(limit);
  if (error || !data) return [];
  const rows = data as Array<{
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
    followers_count: number | null;
    rating_avg: number | null;
    rating_count: number | null;
    is_verified: boolean | null;
    is_referred: boolean | null;
  }>;
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.display_name?.trim() || r.handle || "Vendeur",
      handle: (r.handle ?? "").replace(/^@/, ""),
      avatar: (await resolveAvatarUrl(r.avatar_url)) || null,
      followers: r.followers_count ?? 0,
      ratingAvg: r.rating_avg != null && Number(r.rating_avg) > 0 ? Number(r.rating_avg) : null,
      ratingCount: r.rating_count ?? 0,
      isVerified: !!r.is_verified,
      isReferred: !!r.is_referred,
      live: false,
    })),
  );
}
