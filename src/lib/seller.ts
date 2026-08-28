import { resolveAvatarUrl } from "./storage";
import { supabase } from "./supabase";

export type SellerPublic = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  followers: number;
  isVerified: boolean;
  isReferred: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  salesDelivered: number;
};

export async function fetchSellerPublic(userId: string): Promise<SellerPublic | null> {
  const [{ data, error }, salesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, handle, avatar_url, banner_url, bio, followers_count, is_verified, is_referred, rating_avg, rating_count",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", userId)
      .eq("fulfillment_status", "delivered"),
  ]);
  if (error || !data) return null;
  const [avatarUrl, bannerUrl] = await Promise.all([
    resolveAvatarUrl(data.avatar_url),
    resolveAvatarUrl(data.banner_url),
  ]);
  const ratingAvg = data.rating_avg != null ? Number(data.rating_avg) : null;
  return {
    id: data.id,
    displayName: data.display_name?.trim() || data.handle || "Vendeur",
    handle: data.handle?.replace(/^@/, "") || "kidi",
    avatarUrl: avatarUrl || null,
    bannerUrl: bannerUrl || null,
    bio: data.bio,
    followers: data.followers_count ?? 0,
    isVerified: !!data.is_verified,
    isReferred: !!data.is_referred,
    ratingAvg: ratingAvg && ratingAvg > 0 ? ratingAvg : null,
    ratingCount: data.rating_count ?? 0,
    salesDelivered: salesRes.count ?? 0,
  };
}

export async function uploadBanner(userId: string, picked: { blob: Blob; ext: string; contentType: string }): Promise<string> {
  const path = `${userId}/banner-${Date.now()}.${picked.ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, picked.blob, {
    upsert: true,
    contentType: picked.contentType || "image/jpeg",
  });
  if (error) throw error;
  const { error: upd } = await supabase.from("profiles").update({ banner_url: path }).eq("id", userId);
  if (upd) throw upd;
  return (await resolveAvatarUrl(path)) || path;
}
