import { useEffect, useRef, useState } from "react";
import type { ViewerRoomState, ViewerActions } from "./live-viewer";
import type { LiveProductRow } from "./live-host";
import type { GiftKey } from "./gifts";
import { nextBidAmount, type Currency } from "./money";

const DEMO_NAMES = [
  "Mariama", "Yves", "Awa", "Kevin", "Fatou", "Lucas",
  "Nina", "Théo", "Chloé", "Amir", "Sarah", "Baptiste",
];

const DEMO_COMMENTS = [
  "C'est magnifique 😍", "Combien ?", "Je veux !", "Trop beau 🔥",
  "Il reste du stock ?", "Quel est le prix ?", "Je prends !",
  "Top qualité 👏", "Livraison en combien de temps ?", "Wow 💎",
  "C'est authentique ?", "J'adore !", "Vendu !", "Moi aussi je veux",
  "Super live 🎉", "Bravo", "❤️", "🔥🔥🔥", "👏👏",
];

const DEMO_PRODUCTS: LiveProductRow[] = [
  {
    id: "demo-prod-1",
    live_id: "demo-live",
    name: "Sac Louis Vuitton Neverfull",
    image_url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=70",
    mode: "auction",
    start_price: 150,
    price: 150,
    stock: 1,
    status: "active",
    timer_seconds: 30,
    position: 0,
    auction_deadline_at: new Date(Date.now() + 30_000).toISOString(),
    auction_round: 1,
    sold_to_identity: null,
    final_price: null,
  },
  {
    id: "demo-prod-2",
    live_id: "demo-live",
    name: "Air Jordan 4 Retro",
    image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=70",
    mode: "fixed",
    start_price: 89,
    price: 89,
    stock: 3,
    status: "upcoming",
    timer_seconds: 45,
    position: 1,
    auction_deadline_at: null,
    sold_to_identity: null,
    final_price: null,
  },
  {
    id: "demo-prod-3",
    live_id: "demo-live",
    name: "Collier or 18 carats",
    image_url: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&q=70",
    mode: "auction",
    start_price: 75,
    price: 75,
    stock: 1,
    status: "upcoming",
    timer_seconds: 35,
    position: 2,
    auction_deadline_at: null,
    sold_to_identity: null,
    final_price: null,
  },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function uid() {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Simulates a live viewer experience for demo/fictitious streams.
 * Generates fake chat, bids, products, and viewer counts for Apple Review.
 */
export function useDemoViewerSim(currency: Currency): ViewerRoomState & ViewerActions {
  const [chat, setChat] = useState<ViewerRoomState["chat"]>([]);
  const [viewers, setViewers] = useState(Math.floor(Math.random() * 80) + 30);
  const [products] = useState<LiveProductRow[]>(DEMO_PRODUCTS);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(DEMO_PRODUCTS[0]!.start_price);
  const [lastBid, setLastBid] = useState<ViewerRoomState["lastBid"]>(null);
  const [lastGift, setLastGift] = useState<ViewerRoomState["lastGift"]>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const deadlineRef = useRef(Date.now() + 30_000);
  const seqRef = useRef(0);

  const featured = products[featuredIdx] ?? null;
  const auctionActive = featured?.mode === "auction" && featured.status === "active";

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0 && auctionActive) {
        deadlineRef.current = Date.now() + 35_000;
        setFeaturedIdx((i) => Math.min(i + 1, products.length - 1));
        setCurrentPrice(products[Math.min(featuredIdx + 1, products.length - 1)]?.start_price ?? 50);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [auctionActive, featuredIdx, products]);

  useEffect(() => {
    const addChat = () => {
      const name = pick(DEMO_NAMES);
      const text = pick(DEMO_COMMENTS);
      setChat((prev) => [...prev.slice(-20), { id: uid(), user: name, text, system: false }]);
    };
    addChat();
    const interval = setInterval(addChat, 2500 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!auctionActive) return;
    const doBid = () => {
      const name = pick(DEMO_NAMES);
      const next = nextBidAmount(currentPrice, currency);
      setCurrentPrice(next);
      setLastBid({
        productId: featured!.id,
        amount: next,
        bidderId: `sim-${name}`,
        bidderName: name,
        ts: Date.now(),
        auctionRound: 1,
      });
      deadlineRef.current = Math.max(deadlineRef.current, Date.now() + 8_000);
      setChat((prev) => [
        ...prev.slice(-20),
        { id: uid(), user: name, text: `Enchère ${next}€ 🔥`, system: false },
      ]);
    };
    const interval = setInterval(doBid, 5000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, [auctionActive, currentPrice, currency, featured]);

  useEffect(() => {
    setViewers((v) => v + Math.floor(Math.random() * 3) - 1);
    const interval = setInterval(() => {
      setViewers((v) => Math.max(10, v + Math.floor(Math.random() * 5) - 2));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const sendChat = async (text: string) => {
    setChat((prev) => [...prev.slice(-20), { id: uid(), user: "Moi", text, system: false }]);
  };

  const sendHeart = () => {
    setChat((prev) => [...prev.slice(-20), { id: uid(), user: "Moi", text: "❤️", system: false }]);
  };

  const placeBid = async () => {
    const next = nextBidAmount(currentPrice, currency);
    setCurrentPrice(next);
    setLastBid({
      productId: featured?.id ?? "",
      amount: next,
      bidderId: "me",
      bidderName: "Moi",
      ts: Date.now(),
      auctionRound: 1,
    });
    deadlineRef.current = Math.max(deadlineRef.current, Date.now() + 8_000);
    return { ok: true as const, amount: next };
  };

  const buyNow = async () => {
    setChat((prev) => [...prev.slice(-20), { id: uid(), user: "", text: "Achat confirmé ! 🎉", system: true }]);
    return { ok: true as const, orderId: "demo-order" };
  };

  const sendGift = async (giftKey: GiftKey) => {
    setLastGift({ giftKey, fromName: "Moi", at: Date.now() });
    setChat((prev) => [...prev.slice(-20), { id: uid(), user: "", text: "🎁 Cadeau envoyé !", system: true }]);
    return { ok: true as const };
  };

  return {
    liveStatus: "live",
    currency,
    products,
    featured: featured ? { ...featured, price: currentPrice } : null,
    auction: auctionActive
      ? { productId: featured!.id, deadlineMs: deadlineRef.current, timerSec: 30, auctionRound: 1 }
      : null,
    timeLeft,
    lastBid,
    chat,
    viewers,
    lastReveal: null,
    lastGift,
    loading: false,
    error: null,
    sendChat,
    sendHeart,
    placeBid,
    buyNow,
    sendGift,
    refreshProducts: async () => {},
    clearReveal: () => {},
  };
}
