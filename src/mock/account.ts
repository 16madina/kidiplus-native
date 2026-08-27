export function formatEur(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export type WalletTx = {
  id: string;
  type: "topup" | "purchase" | "refund";
  label: string;
  cents: number;
  time: string;
};

export const MOCK_WALLET_TX: WalletTx[] = [
  { id: "w1", type: "purchase", label: "Jordan 4 Retro · Kevin Sneaks", cents: -18500, time: "Hier" },
  { id: "w2", type: "topup", label: "Rechargement carte", cents: 20000, time: "Il y a 2 j" },
  { id: "w3", type: "refund", label: "Remboursement palette", cents: 2800, time: "Il y a 5 j" },
  { id: "w4", type: "purchase", label: "Collier or 18k · Fatou Bijoux", cents: -12000, time: "Il y a 1 sem." },
];

export const TOPUP_AMOUNTS = [2000, 5000, 10000, 20000];

export type ShopItem = {
  id: string;
  name: string;
  price: string;
  stock: number;
  kind: "auction" | "fixed";
  image: string;
  active: boolean;
  priceValue?: number;
  currency?: string;
  description?: string | null;
  imagePath?: string | null;
};

export const MOCK_SHOP_ITEMS: ShopItem[] = [
  {
    id: "si1",
    name: "Jordan 4 Retro White Oreo",
    price: "185 €",
    stock: 3,
    kind: "auction",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=70",
    active: true,
  },
  {
    id: "si2",
    name: "Palette fards nude",
    price: "28 €",
    stock: 12,
    kind: "fixed",
    image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&q=70",
    active: true,
  },
  {
    id: "si3",
    name: "Sac Speedy 30 authentifié",
    price: "890 €",
    stock: 1,
    kind: "auction",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=70",
    active: true,
  },
];

export type MockOrder = {
  id: string;
  name: string;
  seller: string;
  price: string;
  image: string;
  status: "awaitingPayment" | "paid" | "shipped" | "delivered" | "failed" | "cancelled" | "refunded";
  when: string;
};

export const MOCK_PURCHASES: MockOrder[] = [
  {
    id: "o1",
    name: "Jordan 4 Retro White Oreo",
    seller: "Kevin Sneaks",
    price: "185 €",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=70",
    status: "shipped",
    when: "Expédié · il y a 1 j",
  },
  {
    id: "o2",
    name: "Collier or 18k",
    seller: "Fatou Bijoux",
    price: "120 €",
    image: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&q=70",
    status: "delivered",
    when: "Livré · il y a 6 j",
  },
  {
    id: "o3",
    name: "Flacon Baccarat Rouge",
    seller: "Parfum Zoé",
    price: "210 €",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=70",
    status: "awaitingPayment",
    when: "À payer avant demain 20h",
  },
];

export const MOCK_SALES: MockOrder[] = [
  {
    id: "s1",
    name: "Palette fards nude",
    seller: "Toi",
    price: "28 €",
    image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&q=70",
    status: "paid",
    when: "À expédier · Aïcha M.",
  },
  {
    id: "s2",
    name: "Jordan 4 Retro White Oreo",
    seller: "Toi",
    price: "185 €",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=70",
    status: "shipped",
    when: "Expédié · Kevin D.",
  },
];

export type EarningRow = {
  id: string;
  label: string;
  cents: number;
  state: "released" | "pending";
  when: string;
};

export const MOCK_EARNINGS: EarningRow[] = [
  { id: "e1", label: "Jordan 4 Retro · Kevin D.", cents: 16650, state: "released", when: "Libéré · hier" },
  { id: "e2", label: "Palette nude · Aïcha M.", cents: 2520, state: "pending", when: "Escrow · 5 j restants" },
  { id: "e3", label: "Collier or · Lina B.", cents: 10800, state: "released", when: "Libéré · il y a 4 j" },
];

export type Address = {
  id: string;
  label: string;
  line: string;
  city: string;
  primary?: boolean;
};

export const MOCK_ADDRESSES: Address[] = [
  { id: "a1", label: "Maison", line: "12 rue des Lilas", city: "75011 Paris", primary: true },
  { id: "a2", label: "Bureau", line: "8 avenue de la République", city: "69003 Lyon" },
];

export const HELP_FAQS = [
  {
    q: "Comment enchérir pendant un live ?",
    a: "Ouvre le live, tape Enchérir. Le montant grimpe à chaque offre. Si tu gagnes, tu paies avec ton solde KiDi+ ou une carte.",
  },
  {
    q: "Quand est-ce que le vendeur est payé ?",
    a: "Les fonds sont bloqués jusqu’à confirmation de livraison, ou automatiquement après 7 jours.",
  },
  {
    q: "Comment recharger mon portefeuille ?",
    a: "Profil → Portefeuille → Recharger. Choisis 20, 50, 100 ou 200 €. (Mock : le solde se met à jour tout de suite.)",
  },
  {
    q: "Je veux vendre en live",
    a: "Deviens vendeur depuis le profil, prépare tes articles dans Ma boutique, puis Passe en direct.",
  },
];
