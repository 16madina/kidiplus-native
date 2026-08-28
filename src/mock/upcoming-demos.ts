import type { LiveStream } from "./lives";
import { fictitiousSellerId } from "./lives";

/** Demo upcoming lives shown on Home when few/no real scheduled rows. */
const DEMO: Array<{
  seller: string;
  title: string;
  category: LiveStream["category"];
  startsInMin: number;
  thumbnail: string;
}> = [
  {
    seller: "Marie Vintage",
    title: "Friperie de luxe : Chanel, Dior, YSL",
    category: "Fashion",
    startsInMin: 45,
    thumbnail:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=70",
  },
  {
    seller: "Tech Amir",
    title: "iPhone reconditionnés + AirPods garantis",
    category: "Electronics",
    startsInMin: 120,
    thumbnail:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&q=70",
  },
  {
    seller: "Yassine Cards",
    title: "One Piece TCG — cartes rares OP07",
    category: "Cards",
    startsInMin: 27,
    thumbnail:
      "https://images.unsplash.com/photo-1529154691717-3306083d869e?w=400&q=70",
  },
  {
    seller: "Sarah Skin",
    title: "Soins coréens : masques & sérums",
    category: "Beauty",
    startsInMin: 90,
    thumbnail:
      "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=70",
  },
  {
    seller: "Inès Or",
    title: "Chaînes cubaines argent 925 massif",
    category: "Jewelry",
    startsInMin: 12,
    thumbnail:
      "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=400&q=70",
  },
];

export function fictionalUpcomingLives(): LiveStream[] {
  return DEMO.map((d, i) => {
    const sellerId = fictitiousSellerId(d.seller);
    return {
      id: `upcoming-demo-${i}`,
      seller: d.seller,
      avatar: `https://i.pravatar.cc/80?u=${encodeURIComponent(d.seller)}`,
      title: d.title,
      thumbnail: d.thumbnail,
      viewers: 0,
      category: d.category,
      sellerId,
      handle: d.seller.toLowerCase().replace(/\s+/g, ""),
      currency: "EUR",
      fictitious: true,
      scheduled: true,
      startsInMin: d.startsInMin,
      startedAt: new Date(Date.now() + d.startsInMin * 60_000).toISOString(),
    };
  });
}

/** Real scheduled first, then demos — always at least the demo set. */
export function mergeUpcomingWithDemos(real: LiveStream[]): LiveStream[] {
  const demos = fictionalUpcomingLives();
  if (real.length === 0) return demos;
  const realIds = new Set(real.map((s) => s.seller.toLowerCase()));
  const extra = demos.filter((d) => !realIds.has(d.seller.toLowerCase()));
  return [...real, ...extra].slice(0, 12);
}
