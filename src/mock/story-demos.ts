import type { VitrineStory } from "../lib/vitrine-stories";

function demoSellerId(seller: string): string {
  const slug = seller
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `fictitious:${slug || "seller"}`;
}

const AVATAR = (name: string) => `https://i.pravatar.cc/160?u=${encodeURIComponent(name)}`;

/** Permanent demo stories so the home bar is never empty. Remove when real users fill it. */
const DEMO: Array<{
  seller: string;
  handle: string;
  photos: string[];
}> = [
  {
    seller: "Marie Vintage",
    handle: "marievintage",
    photos: [
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=70",
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=70",
    ],
  },
  {
    seller: "Sarah Skin",
    handle: "sarahskin",
    photos: [
      "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=70",
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=70",
    ],
  },
  {
    seller: "Inès Or",
    handle: "inesor",
    photos: [
      "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=800&q=70",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=70",
    ],
  },
  {
    seller: "Tech Amir",
    handle: "techamir",
    photos: [
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=70",
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=70",
    ],
  },
  {
    seller: "Léa Mode",
    handle: "leamode",
    photos: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=70",
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=70",
    ],
  },
  {
    seller: "Yassine Cards",
    handle: "yassinecards",
    photos: [
      "https://images.unsplash.com/photo-1529154691717-3306083d869e?w=800&q=70",
      "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=800&q=70",
    ],
  },
  {
    seller: "Kadi Bags",
    handle: "kadibags",
    photos: [
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=70",
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=70",
    ],
  },
  {
    seller: "Aïcha Boutique",
    handle: "aichaboutique",
    photos: [
      "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=70",
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=70",
    ],
  },
];

export function demoHomeStories(nowMs = Date.now()): VitrineStory[] {
  const out: VitrineStory[] = [];
  DEMO.forEach((d, i) => {
    const userId = demoSellerId(d.seller);
    d.photos.forEach((url, j) => {
      out.push({
        id: `demo-story-${i}-${j}`,
        userId,
        mediaUrl: url,
        posterUrl: url,
        displayName: d.seller,
        handle: d.handle,
        avatarUrl: AVATAR(d.seller),
        createdAt: new Date(nowMs - (i * 3 + j) * 60_000).toISOString(),
        expiresAt: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
        unread: true,
        clip: null,
        fictitious: true,
      });
    });
  });
  return out;
}

/** Keep every real story, then append demo sellers that are not already present. */
export function mergeStoriesWithDemos(real: VitrineStory[]): VitrineStory[] {
  const taken = new Set(real.map((s) => s.userId));
  const extras = demoHomeStories().filter((s) => !taken.has(s.userId));
  return [...real, ...extras];
}
