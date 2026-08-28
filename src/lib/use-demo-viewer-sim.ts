import { useCallback, useEffect, useRef, useState } from "react";
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

const AUCTION_SECONDS = 30;
const FIXED_SHOWCASE_MS = 16_000;
const REVEAL_PAUSE_MS = 4_500;
const SUDDEN_DEATH_WINDOW_MS = 10_000;

function makeDemoProducts(): LiveProductRow[] {
  return [
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
      timer_seconds: AUCTION_SECONDS,
      position: 0,
      auction_deadline_at: new Date(Date.now() + AUCTION_SECONDS * 1000).toISOString(),
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
      timer_seconds: AUCTION_SECONDS,
      position: 2,
      auction_deadline_at: null,
      sold_to_identity: null,
      final_price: null,
    },
  ];
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function uid() {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Simulates a full live viewer experience for demo/fictitious streams:
 * chat, bids (yours included), sudden death, winner reveal, product
 * rotation, buy-now and gifts — everything Apple Review needs to see.
 */
export function useDemoViewerSim(currency: Currency): ViewerRoomState & ViewerActions {
  const [chat, setChat] = useState<ViewerRoomState["chat"]>([]);
  const [viewers, setViewers] = useState(Math.floor(Math.random() * 80) + 30);
  const [products, setProducts] = useState<LiveProductRow[]>(makeDemoProducts);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(150);
  const [lastBid, setLastBid] = useState<ViewerRoomState["lastBid"]>(null);
  const [lastReveal, setLastReveal] = useState<ViewerRoomState["lastReveal"]>(null);
  const [lastGift, setLastGift] = useState<ViewerRoomState["lastGift"]>(null);
  const [heartPulse, setHeartPulse] = useState(0);
  const [timeLeft, setTimeLeft] = useState(AUCTION_SECONDS);
  const [suddenDeathTick, setSuddenDeathTick] = useState(0);
  const deadlineRef = useRef(Date.now() + AUCTION_SECONDS * 1000);
  const phaseRef = useRef<"auction" | "fixed" | "break">("auction");
  const lastBidRef = useRef<ViewerRoomState["lastBid"]>(null);
  const priceRef = useRef(150);
  const featuredIdxRef = useRef(0);
  const productsRef = useRef(products);
  lastBidRef.current = lastBid;
  priceRef.current = currentPrice;
  featuredIdxRef.current = featuredIdx;
  productsRef.current = products;

  const featured = products[featuredIdx] ?? null;
  const auctionActive =
    phaseRef.current === "auction" && featured?.mode === "auction" && featured.status === "active";

  const pushChat = useCallback((user: string, text: string, system = false) => {
    setChat((prev) => [...prev.slice(-20), { id: uid(), user, text, system }]);
  }, []);

  const advanceToNext = useCallback(() => {
    const list = productsRef.current;
    const nextIdx = (featuredIdxRef.current + 1) % list.length;
    const next = list[nextIdx]!;
    setProducts((prev) =>
      prev.map((p, i) =>
        i === nextIdx
          ? { ...p, status: "active", price: p.start_price }
          : p,
      ),
    );
    setFeaturedIdx(nextIdx);
    setCurrentPrice(next.start_price);
    setLastBid(null);
    setSuddenDeathTick(0);
    if (next.mode === "auction") {
      phaseRef.current = "auction";
      deadlineRef.current = Date.now() + AUCTION_SECONDS * 1000;
      pushChat("", `🔨 Enchère : ${next.name}`, true);
    } else {
      phaseRef.current = "fixed";
      deadlineRef.current = Date.now() + FIXED_SHOWCASE_MS;
      pushChat("", `🛍️ En vente : ${next.name}`, true);
    }
  }, [pushChat]);

  const endAuction = useCallback(() => {
    const list = productsRef.current;
    const idx = featuredIdxRef.current;
    const product = list[idx];
    if (!product) return;
    const bid = lastBidRef.current;
    const won = !!bid && bid.productId === product.id;
    setLastReveal({
      endId: uid(),
      productId: product.id,
      productName: product.name,
      // Prefix keeps demo winner ids from ever matching a real user id.
      winnerId: won ? `demo-${bid!.bidderId}` : null,
      winnerName: won ? bid!.bidderName : null,
    });
    setProducts((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, status: won ? "sold" : "unsold", final_price: priceRef.current } : p,
      ),
    );
    if (won) pushChat("", `🏆 ${bid!.bidderName} remporte ${product.name} !`, true);
    phaseRef.current = "break";
    deadlineRef.current = Date.now() + REVEAL_PAUSE_MS;
  }, [pushChat]);

  // Main clock: countdown + phase transitions.
  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(left);
      if (left > 0) return;
      if (phaseRef.current === "auction") endAuction();
      else advanceToNext();
    }, 500);
    return () => clearInterval(interval);
  }, [endAuction, advanceToNext]);

  useEffect(() => {
    const addChat = () => pushChat(pick(DEMO_NAMES), pick(DEMO_COMMENTS));
    addChat();
    const interval = setInterval(addChat, 2500 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [pushChat]);

  const registerBid = useCallback(
    (bidderId: string, bidderName: string) => {
      const product = productsRef.current[featuredIdxRef.current];
      if (!product || product.mode !== "auction" || phaseRef.current !== "auction") return null;
      const next = nextBidAmount(priceRef.current, currency);
      setCurrentPrice(next);
      setLastBid({
        productId: product.id,
        amount: next,
        bidderId,
        bidderName,
        ts: Date.now(),
        auctionRound: 1,
      });
      // Anti-snipe (mort subite) like real auctions.
      const msLeft = deadlineRef.current - Date.now();
      if (msLeft < SUDDEN_DEATH_WINDOW_MS) {
        deadlineRef.current = Date.now() + SUDDEN_DEATH_WINDOW_MS;
        setSuddenDeathTick((n) => n + 1);
      }
      return next;
    },
    [currency],
  );

  // Bot bids on the running auction.
  useEffect(() => {
    if (!auctionActive) return;
    const doBid = () => {
      const name = pick(DEMO_NAMES);
      const amount = registerBid(`sim-${name}`, name);
      if (amount != null) pushChat(name, `Enchère ${amount} 🔥`);
    };
    const interval = setInterval(doBid, 5000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, [auctionActive, registerBid, pushChat]);

  useEffect(() => {
    setViewers((v) => v + Math.floor(Math.random() * 3) - 1);
    const interval = setInterval(() => {
      setViewers((v) => Math.max(10, v + Math.floor(Math.random() * 5) - 2));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const sendChat = async (text: string) => {
    pushChat("Moi", text);
  };

  const sendHeart = () => {
    setHeartPulse((n) => n + 1);
    pushChat("Moi", "❤️");
  };

  const placeBid = async () => {
    const amount = registerBid("me", "Moi");
    if (amount == null) return { ok: false as const, error: "Aucune enchère en cours" };
    pushChat("Moi", `Enchère ${amount} 🔥`);
    return { ok: true as const, amount };
  };

  const buyNow = async () => {
    pushChat("", "Achat confirmé ! 🎉", true);
    return { ok: true as const, orderId: "demo-order" };
  };

  const sendGift = async (giftKey: GiftKey) => {
    setLastGift({ giftKey, fromName: "Moi", at: Date.now() });
    pushChat("", "🎁 Cadeau envoyé !", true);
    return { ok: true as const };
  };

  return {
    liveStatus: "live",
    currency,
    products,
    featured: featured ? { ...featured, price: currentPrice } : null,
    auction: auctionActive
      ? {
          productId: featured!.id,
          deadlineMs: deadlineRef.current,
          timerSec: AUCTION_SECONDS,
          auctionRound: 1,
        }
      : null,
    timeLeft,
    suddenDeathTick,
    lastBid,
    chat,
    viewers,
    lastReveal,
    lastGift,
    heartPulse,
    loading: false,
    error: null,
    sendChat,
    sendHeart,
    placeBid,
    buyNow,
    sendGift,
    refreshProducts: async () => {},
    clearReveal: () => setLastReveal(null),
  };
}
