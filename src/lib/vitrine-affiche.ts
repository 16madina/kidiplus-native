import { fetchVitrinePosts, createVitrinePost, type VitrineFeedPost } from "./vitrine";
import {
  afficheArticleCount,
  encodeAfficheCaption,
  parseAfficheCaption,
  type AfficheLayout,
} from "./vitrine-affiche-logic";

export * from "./vitrine-affiche-logic";

export type VitrineAffiche = {
  id: string;
  userId: string | null;
  title: string;
  layout: AfficheLayout;
  sellerName: string;
  shopName: string;
  handle: string;
  avatarUrl: string | null;
  category: string;
  articleCount: number;
  createdAt: string;
};

export function postToAffiche(post: VitrineFeedPost): VitrineAffiche | null {
  const layout = parseAfficheCaption(post.caption);
  if (!layout) return null;
  return {
    id: post.id,
    userId: post.userId,
    title: layout.title || layout.layers.find((l) => l.kind === "text")?.text || "Affiche",
    layout: {
      ...layout,
      backgroundUri: layout.backgroundUri || post.mediaUrls[0] || null,
    },
    sellerName: post.sellerName,
    shopName: layout.shopName.trim() || `${post.sellerName} Boutique`,
    handle: post.handle,
    avatarUrl: post.avatarUrl,
    category: layout.category.trim(),
    articleCount: afficheArticleCount(layout),
    createdAt: post.createdAt || post.id,
  };
}

export async function fetchVitrineAffiches(limit = 30): Promise<VitrineAffiche[]> {
  const rows = await fetchVitrinePosts(limit, 0);
  return rows.map(postToAffiche).filter((a): a is VitrineAffiche => !!a);
}

export async function createVitrineAffiche(
  layout: AfficheLayout,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const media = layout.backgroundUri ? [layout.backgroundUri] : ["affiche://color"];
  return createVitrinePost({
    mediaUrls: media,
    mediaType: "image",
    caption: encodeAfficheCaption(layout),
  });
}
