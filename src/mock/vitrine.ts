import type { LiveStream } from "./lives";

export type VitrinePost = {
  id: string;
  seller: string;
  handle: string;
  avatar: string;
  caption: string;
  image: number;
  likes: number;
  comments: number;
  live?: LiveStream;
};

const vitrineImages = [
  require("../../assets/vitrine/vitrine-1.jpg"),
  require("../../assets/vitrine/vitrine-2.jpg"),
  require("../../assets/vitrine/vitrine-3.jpg"),
  require("../../assets/vitrine/vitrine-4.jpg"),
  require("../../assets/vitrine/vitrine-5.jpg"),
  require("../../assets/vitrine/vitrine-6.jpg"),
  require("../../assets/vitrine/vitrine-2b.jpg"),
  require("../../assets/vitrine/vitrine-2c.jpg"),
];

const POSTS: Omit<VitrinePost, "image" | "id">[] = [
  {
    seller: "Aïcha Beauty",
    handle: "aichabeauty",
    avatar: "https://i.pravatar.cc/80?u=Aicha%20Beauty",
    caption: "Nouveautés maquillage en live ce soir 💄 enchères dès 5€",
    likes: 1284,
    comments: 86,
  },
  {
    seller: "Kevin Sneaks",
    handle: "kevinsneaks",
    avatar: "https://i.pravatar.cc/80?u=Kevin%20Sneaks",
    caption: "Drop Jordan 4 — tailles 42-45. Qui dit plus ?",
    likes: 2103,
    comments: 154,
  },
  {
    seller: "Lina Bags",
    handle: "linabags",
    avatar: "https://i.pravatar.cc/80?u=Lina%20Bags",
    caption: "Sacs authentifiés, certificats en story. Live demain 20h.",
    likes: 876,
    comments: 41,
  },
  {
    seller: "Fatou Bijoux",
    handle: "fatoubijoux",
    avatar: "https://i.pravatar.cc/80?u=Fatou%20Bijoux",
    caption: "Or 18 carats — départ à 10€. Rejoins le live.",
    likes: 654,
    comments: 29,
  },
  {
    seller: "Parfum Zoé",
    handle: "parfumzoe",
    avatar: "https://i.pravatar.cc/80?u=Parfum%20Zoe",
    caption: "Décants niche & designer. Stories du jour ✨",
    likes: 432,
    comments: 18,
  },
  {
    seller: "Marie Vintage",
    handle: "marievintage",
    avatar: "https://i.pravatar.cc/80?u=Marie%20Vintage",
    caption: "Friperie de luxe : Chanel, Dior, YSL — pièces uniques.",
    likes: 1902,
    comments: 97,
  },
];

export function mockVitrinePosts(): VitrinePost[] {
  return POSTS.map((p, i) => ({
    ...p,
    id: `vitrine-${i}`,
    image: vitrineImages[i % vitrineImages.length],
  }));
}

export const mockStories = [
  { id: "you", name: "Votre story", avatar: null as string | null, you: true },
  { id: "s1", name: "Aïcha", avatar: "https://i.pravatar.cc/80?u=Aicha%20Beauty", you: false },
  { id: "s2", name: "Kevin", avatar: "https://i.pravatar.cc/80?u=Kevin%20Sneaks", you: false },
  { id: "s3", name: "Lina", avatar: "https://i.pravatar.cc/80?u=Lina%20Bags", you: false },
  { id: "s4", name: "Fatou", avatar: "https://i.pravatar.cc/80?u=Fatou%20Bijoux", you: false },
  { id: "s5", name: "Zoé", avatar: "https://i.pravatar.cc/80?u=Parfum%20Zoe", you: false },
];

export type ShopProduct = {
  id: string;
  name: string;
  seller: string;
  price: string;
  image: string;
};

export const MOCK_PRODUCTS: ShopProduct[] = [
  {
    id: "p1",
    name: "Jordan 4 Retro White Oreo",
    seller: "Kevin Sneaks",
    price: "185 €",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=70",
  },
  {
    id: "p2",
    name: "Sac Speedy 30 authentifié",
    seller: "Lina Bags",
    price: "890 €",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=70",
  },
  {
    id: "p3",
    name: "Collier or 18k",
    seller: "Fatou Bijoux",
    price: "120 €",
    image: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&q=70",
  },
  {
    id: "p4",
    name: "Palette fards nude",
    seller: "Aïcha Beauty",
    price: "28 €",
    image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&q=70",
  },
  {
    id: "p5",
    name: "Flacon Baccarat Rouge",
    seller: "Parfum Zoé",
    price: "210 €",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=70",
  },
  {
    id: "p6",
    name: "iPhone 13 reconditionné",
    seller: "Tech Amir",
    price: "399 €",
    image: "https://images.unsplash.com/photo-1512446816042-444d641267d4?w=400&q=70",
  },
];

export type MockSeller = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  followers: number;
  live: boolean;
};

export const MOCK_SELLERS: MockSeller[] = [
  { id: "s1", name: "Aïcha Beauty", handle: "aichabeauty", avatar: "https://i.pravatar.cc/80?u=Aicha%20Beauty", followers: 12400, live: true },
  { id: "s2", name: "Kevin Sneaks", handle: "kevinsneaks", avatar: "https://i.pravatar.cc/80?u=Kevin%20Sneaks", followers: 8900, live: true },
  { id: "s3", name: "Lina Bags", handle: "linabags", avatar: "https://i.pravatar.cc/80?u=Lina%20Bags", followers: 5600, live: false },
  { id: "s4", name: "Fatou Bijoux", handle: "fatoubijoux", avatar: "https://i.pravatar.cc/80?u=Fatou%20Bijoux", followers: 4300, live: true },
  { id: "s5", name: "Marie Vintage", handle: "marievintage", avatar: "https://i.pravatar.cc/80?u=Marie%20Vintage", followers: 15200, live: false },
  { id: "s6", name: "Tech Amir", handle: "techamir", avatar: "https://i.pravatar.cc/80?u=Tech%20Amir", followers: 3100, live: false },
];
