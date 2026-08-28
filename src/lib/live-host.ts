import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { resolveStoredImage } from "./storage";
import { uploadLiveProductImage } from "./lives";
import { isSimBidderId } from "./prelaunch-live-sim";
import type { LiveDraftProduct } from "./broadcast-products";
import type { GiftKey } from "./gifts";

/** Anti-snipe: a bid in the last N seconds resets the timer to N seconds. */
export const AUCTION_EXTENSION_WINDOW_SECONDS = 10;
export const AUCTION_EXTENSION_RESET_SECONDS = 10;

export type LiveProductStatus = "upcoming" | "active" | "sold" | "out" | "unsold";

export type LiveProductRow = {
  id: string;
  live_id: string;
  name: string;
  image_url: string | null;
  mode: "auction" | "fixed";
  start_price: number;
  price: number;
  stock: number;
  timer_seconds: number;
  status: LiveProductStatus;
  sold_to_identity: string | null;
  final_price: number | null;
  position: number;
  auction_deadline_at: string | null;
  auction_round?: number | null;
  shop_product_id?: string | null;
};

export type AuctionStartEvt = {
  productId: string;
  deadlineMs: number;
  timerSec: number;
  auctionRound?: number;
};

export type AuctionEndReveal = {
  endId: string;
  productId: string;
  productName: string | null;
  winnerId: string | null;
  winnerName: string | null;
};

/** Same shape as web `GiftEvt` — id = live_gifts.id for broadcast/postgres dedupe. */
export type HostGiftEvt = {
  id: string;
  giftKey: GiftKey | string;
  senderId?: string;
  senderName: string;
  at: number;
};

type GiftDbRow = {
  id: string;
  sender_id: string;
  gift_key: string;
  created_at?: string | null;
};

export type HostChatMsg = {
  id: string;
  user: string;
  text: string;
  system?: boolean;
  isHost?: boolean;
};

export type HostPresenceViewer = {
  identity: string;
  name: string;
};

export type LastBidEvt = {
  productId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  ts: number;
  auctionRound: number;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function auctionStartFromProduct(row: LiveProductRow): AuctionStartEvt | null {
  if (row.mode !== "auction" || row.status !== "active" || !row.auction_deadline_at) return null;
  const deadlineMs = new Date(row.auction_deadline_at).getTime();
  if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now() - 3_000) return null;
  return {
    productId: row.id,
    deadlineMs,
    timerSec: Math.max(1, Number(row.timer_seconds ?? 30)),
    ...(row.auction_round != null ? { auctionRound: Number(row.auction_round) } : {}),
  };
}

function isDone(p: LiveProductRow) {
  return p.status === "sold" || p.status === "unsold" || p.status === "out";
}

async function hydrateProduct(row: LiveProductRow): Promise<LiveProductRow> {
  const url = await resolveStoredImage("live-products", row.image_url, [
    "shop-products",
    "live-covers",
  ]);
  return { ...row, image_url: url ?? row.image_url };
}

export async function fetchLiveProducts(liveId: string): Promise<LiveProductRow[]> {
  const { data } = await supabase
    .from("live_products")
    .select(
      "id, live_id, name, image_url, mode, start_price, price, stock, timer_seconds, status, sold_to_identity, final_price, position, auction_deadline_at, auction_round, shop_product_id",
    )
    .eq("live_id", liveId)
    .order("position", { ascending: true });
  const rows = (data ?? []) as LiveProductRow[];
  return Promise.all(rows.map(hydrateProduct));
}

export async function startAuctionInDb(productId: string): Promise<{
  ok: boolean;
  deadlineMs?: number;
  timerSec?: number;
  auctionRound?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc("start_auction", {
    _product_id: productId,
  } as never);
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as {
    ok?: boolean;
    deadline_ms?: number;
    timer_sec?: number;
    auction_round?: number;
    error?: string;
  };
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    deadlineMs: Number(r.deadline_ms),
    timerSec: Number(r.timer_sec),
    ...(r.auction_round != null ? { auctionRound: Number(r.auction_round) } : {}),
  };
}

export async function finalizeAuctionInDb(args: {
  liveId: string;
  productId: string;
  winnerId: string | null;
  winnerName: string | null;
  finalPrice: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("finalize_auction_winner", {
    _live_id: args.liveId,
    _product_id: args.productId,
    _winner_id: args.winnerId,
    _winner_name: args.winnerName,
    _final_price: args.finalPrice,
  } as never);
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as { ok?: boolean; error?: string };
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}

export async function activateFixedInDb(productId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("live_products").update({ status: "active" }).eq("id", productId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function stopFixedInDb(productId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("live_products").update({ status: "upcoming" }).eq("id", productId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function settleExpiredAuctions(liveId: string): Promise<void> {
  await supabase.rpc("settle_expired_auctions", { _live_id: liveId } as never);
}

export async function fetchLiveSales(liveId: string): Promise<{ revenue: number; count: number }> {
  const [ordersRes, soldRes] = await Promise.all([
    supabase.from("orders").select("amount, status, item_name").eq("live_id", liveId),
    supabase
      .from("live_products")
      .select("name, final_price, price, status")
      .eq("live_id", liveId)
      .eq("status", "sold"),
  ]);
  const orders = (ordersRes.data ?? []) as { amount: number; status: string; item_name: string | null }[];
  // paid + pending: an adjudicated auction counts as a sale even before payment clears.
  const counted = orders.filter((r) => r.status === "paid" || r.status === "pending");
  const orderNames = new Set(counted.map((o) => (o.item_name ?? "").trim().toLowerCase()));
  const sold = (soldRes.data ?? []) as {
    name: string | null;
    final_price: number | null;
    price: number;
    status: string;
  }[];
  // Auctions marked sold whose winner hasn't created the order yet.
  const extra = sold.filter((p) => !orderNames.has((p.name ?? "").trim().toLowerCase()));
  return {
    revenue:
      counted.reduce((s, o) => s + Number(o.amount), 0) +
      extra.reduce((s, p) => s + Number(p.final_price ?? p.price ?? 0), 0),
    count: counted.length + extra.length,
  };
}

export async function fetchLiveGiftsTotal(liveId: string): Promise<{ count: number; sellerNet: number }> {
  const { data } = await supabase.from("live_gifts").select("seller_net").eq("live_id", liveId);
  const rows = (data ?? []) as { seller_net: number }[];
  return {
    count: rows.length,
    sellerNet: rows.reduce((s, r) => s + Number(r.seller_net ?? 0), 0),
  };
}

export type LivePaidOrder = {
  id: string;
  item_name: string;
  amount: number;
  currency: string | null;
  kind: string | null;
};

export async function fetchLivePaidOrders(liveId: string): Promise<LivePaidOrder[]> {
  const { data } = await supabase
    .from("orders")
    .select("id, item_name, amount, currency, kind, status")
    .eq("live_id", liveId)
    .eq("status", "paid")
    .order("created_at", { ascending: false });
  return ((data ?? []) as LivePaidOrder[]).map((row) => ({
    id: row.id,
    item_name: row.item_name,
    amount: Number(row.amount ?? 0),
    currency: row.currency,
    kind: row.kind,
  }));
}

export async function createLiveProductFromDraft(args: {
  liveId: string;
  userId: string;
  draft: LiveDraftProduct;
}): Promise<{ ok: boolean; error?: string }> {
  let imagePath = args.draft.imagePath ?? null;
  try {
    if (!imagePath && args.draft.picked) {
      imagePath = await uploadLiveProductImage(args.userId, args.draft.picked);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const { data: maxRow } = await supabase
    .from("live_products")
    .select("position")
    .eq("live_id", args.liveId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((maxRow?.position as number | undefined) ?? -1) + 1;
  const { error } = await supabase.from("live_products").insert({
    live_id: args.liveId,
    name: args.draft.name,
    image_url: imagePath,
    mode: args.draft.mode,
    start_price: args.draft.mode === "auction" ? args.draft.startPrice : args.draft.price,
    price: args.draft.mode === "auction" ? args.draft.startPrice : args.draft.price,
    stock: args.draft.stock,
    timer_seconds: args.draft.timerSec,
    status: "upcoming",
    position,
    ...(args.draft.shopProductId ? { shop_product_id: args.draft.shopProductId } : {}),
    ...(args.draft.description ? { description: args.draft.description } : {}),
    ...(args.draft.bidIncrement != null ? { bid_increment: args.draft.bidIncrement } : {}),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function pickFeatured(
  products: LiveProductRow[],
  auctionProductId: string | null,
  featuredId: string | null,
): LiveProductRow | null {
  if (auctionProductId) {
    return products.find((p) => p.id === auctionProductId) ?? null;
  }
  const sorted = [...products].sort((a, b) => a.position - b.position);
  const playable = (p: LiveProductRow) => !isDone(p);
  if (featuredId) {
    const byId = products.find((p) => p.id === featuredId);
    if (byId && playable(byId)) return byId;
  }
  return sorted.find((p) => p.status === "upcoming" && playable(p)) ?? sorted.find(playable) ?? sorted[sorted.length - 1] ?? null;
}

type ChannelHandle = {
  send: (event: string, payload: Record<string, unknown>) => void;
};

export function useHostLiveSession(args: {
  liveId: string;
  identity: string;
  displayName: string;
}) {
  const { liveId, identity, displayName } = args;
  const [products, setProducts] = useState<LiveProductRow[]>([]);
  const [auction, setAuction] = useState<AuctionStartEvt | null>(null);
  const [lastBid, setLastBid] = useState<LastBidEvt | null>(null);
  const [lastExtensionTs, setLastExtensionTs] = useState(0);
  const [suddenDeathTick, setSuddenDeathTick] = useState(0);
  const [chat, setChat] = useState<HostChatMsg[]>([]);
  const [presenceCount, setPresenceCount] = useState(1);
  const [presentViewers, setPresentViewers] = useState<HostPresenceViewer[]>([]);
  const [sales, setSales] = useState({ revenue: 0, count: 0 });
  const [gifts, setGifts] = useState({ count: 0, sellerNet: 0 });
  const [lastGift, setLastGift] = useState<HostGiftEvt | null>(null);
  const [simViewers, setSimViewers] = useState<number | null>(null);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [lastEnd, setLastEnd] = useState<AuctionEndReveal | null>(null);
  const [startedAtMs, setStartedAtMs] = useState(Date.now());
  const [currency, setCurrency] = useState("EUR");
  const [nowMs, setNowMs] = useState(Date.now());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handleRef = useRef<ChannelHandle | null>(null);
  const startingRef = useRef(false);
  const endingRef = useRef<string | null>(null);
  const seenExtendBidRef = useRef<number | null>(null);
  const seenGiftIdsRef = useRef<Set<string>>(new Set());
  const auctionRef = useRef(auction);
  const productsRef = useRef(products);
  const lastBidRef = useRef(lastBid);
  const auctionRoundKeyRef = useRef<string | null>(null);
  const auctionRoundStartTsRef = useRef(0);
  auctionRef.current = auction;
  productsRef.current = products;
  lastBidRef.current = lastBid;
  {
    // Track when the current auction round began (extensions keep the same key).
    const roundKey = auction ? `${auction.productId}:${auction.auctionRound ?? 1}` : null;
    if (roundKey !== auctionRoundKeyRef.current) {
      auctionRoundKeyRef.current = roundKey;
      if (roundKey) auctionRoundStartTsRef.current = Date.now();
    }
  }

  const pushChat = useCallback((msg: HostChatMsg) => {
    setChat((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      const next = [...prev, msg];
      return next.length > 150 ? next.slice(next.length - 150) : next;
    });
  }, []);

  const pushChatRef = useRef(pushChat);
  pushChatRef.current = pushChat;

  const ingestGiftRef = useRef<(evt: HostGiftEvt) => void>(() => {});
  ingestGiftRef.current = (evt: HostGiftEvt) => {
    if (!evt?.id || !evt.giftKey) return;
    if (seenGiftIdsRef.current.has(evt.id)) return;
    if (evt.at && Date.now() - evt.at > 5 * 60_000) return;
    seenGiftIdsRef.current.add(evt.id);
    if (seenGiftIdsRef.current.size > 200) {
      const arr = Array.from(seenGiftIdsRef.current);
      seenGiftIdsRef.current = new Set(arr.slice(arr.length - 100));
    }
    setLastGift(evt);
    pushChatRef.current({
      id: `gift-${evt.id}`,
      user: evt.senderName,
      text: `🎁 ${evt.giftKey}`,
    });
  };

  const ingestGiftRowRef = useRef<(row: GiftDbRow) => Promise<void>>(async () => {});
  ingestGiftRowRef.current = async (row: GiftDbRow) => {
    if (!row?.id || !row.gift_key || seenGiftIdsRef.current.has(row.id)) return;
    let senderName = "Viewer";
    try {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, handle")
        .eq("id", row.sender_id)
        .maybeSingle();
      senderName =
        (data as { display_name?: string | null; handle?: string | null } | null)?.display_name?.trim() ||
        (data as { handle?: string | null } | null)?.handle?.trim() ||
        senderName;
    } catch {
      /* best-effort */
    }
    ingestGiftRef.current({
      id: row.id,
      giftKey: row.gift_key,
      senderId: row.sender_id,
      senderName,
      at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    });
  };

  useEffect(() => {
    seenGiftIdsRef.current = new Set();
    setLastGift(null);
  }, [liveId]);

  // Drop lastGift after the animation window so remount cannot re-flash.
  useEffect(() => {
    if (!lastGift) return;
    const t = setTimeout(() => {
      setLastGift((cur) => (cur?.id === lastGift.id ? null : cur));
    }, 8_000);
    return () => clearTimeout(t);
  }, [lastGift]);

  // Rescue poll — same as web: catch gifts missed while reconnecting.
  useEffect(() => {
    if (!liveId) return;
    let alive = true;
    let inFlight = false;
    let cursorIso = new Date(Date.now() - 5_000).toISOString();

    const rescueGifts = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const { data, error } = await supabase
          .from("live_gifts")
          .select("id, sender_id, gift_key, created_at")
          .eq("live_id", liveId)
          .gte("created_at", cursorIso)
          .order("created_at", { ascending: true })
          .limit(20);
        if (error || !data?.length) return;
        for (const row of data as GiftDbRow[]) {
          await ingestGiftRowRef.current(row);
          if (row.created_at && row.created_at > cursorIso) cursorIso = row.created_at;
        }
        void fetchLiveGiftsTotal(liveId).then((totals) => {
          if (alive) setGifts(totals);
        });
      } finally {
        inFlight = false;
      }
    };

    const id = setInterval(() => void rescueGifts(), 8_000);
    void rescueGifts();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [liveId]);

  const sendBroadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    handleRef.current?.send(event, payload);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [rows, liveRes, salesRes, giftsRes] = await Promise.all([
        fetchLiveProducts(liveId),
        supabase.from("lives").select("currency, started_at").eq("id", liveId).maybeSingle(),
        fetchLiveSales(liveId),
        fetchLiveGiftsTotal(liveId),
      ]);
      if (!alive) return;
      setProducts(rows);
      if (liveRes.data?.currency) setCurrency(String(liveRes.data.currency));
      if (liveRes.data?.started_at) {
        const t = new Date(liveRes.data.started_at).getTime();
        if (Number.isFinite(t)) setStartedAtMs(t);
      }
      setSales(salesRes);
      setGifts(giftsRes);
      const running = rows.find((row) => auctionStartFromProduct(row));
      if (running) {
        const start = auctionStartFromProduct(running);
        if (start) {
          setAuction(start);
          setFeaturedId(running.id);
          const round = running.auction_round ?? 1;
          const { data: bid } = await supabase
            .from("live_bids")
            .select("product_id, bidder_id, bidder_name, amount, auction_round")
            .eq("live_id", liveId)
            .eq("product_id", running.id)
            .eq("auction_round", round)
            .order("amount", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (bid && alive) {
            setLastBid({
              productId: (bid as { product_id: string }).product_id,
              bidderId: (bid as { bidder_id: string }).bidder_id,
              bidderName: (bid as { bidder_name: string }).bidder_name,
              amount: Number((bid as { amount: number }).amount),
              ts: Date.now(),
              auctionRound: Number((bid as { auction_round?: number }).auction_round ?? round),
            });
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [liveId]);

  useEffect(() => {
    const db = supabase
      .channel(`live-db:${liveId}:${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_products", filter: `live_id=eq.${liveId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as LiveProductRow | undefined;
          if (!row?.id) return;
          if (payload.eventType === "DELETE") {
            setProducts((prev) => prev.filter((p) => p.id !== row.id));
            return;
          }
          void hydrateProduct(row).then((hydrated) => {
            setProducts((prev) => {
              const i = prev.findIndex((p) => p.id === hydrated.id);
              if (i < 0) return [...prev, hydrated].sort((a, b) => a.position - b.position);
              const next = [...prev];
              next[i] = { ...next[i]!, ...hydrated, image_url: hydrated.image_url || next[i]!.image_url };
              return next;
            });
            const start = auctionStartFromProduct(hydrated);
            if (start) setAuction(start);
            if (hydrated.mode === "auction" && isDone(hydrated)) {
              setAuction((cur) => (cur && cur.productId === hydrated.id ? null : cur));
            }
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_bids", filter: `live_id=eq.${liveId}` },
        (payload) => {
          const row = payload.new as {
            product_id: string;
            bidder_id: string;
            bidder_name: string;
            amount: number;
            auction_round?: number;
          };
          const amount = Number(row.amount);
          setLastBid({
            productId: row.product_id,
            bidderId: row.bidder_id,
            bidderName: row.bidder_name,
            amount,
            ts: Date.now(),
            auctionRound: Number(row.auction_round ?? 1),
          });
          setProducts((prev) =>
            prev.map((p) => (p.id === row.product_id ? { ...p, price: amount } : p)),
          );
          pushChat({
            id: uid(),
            user: "",
            text: `🔨 ${row.bidder_name} · ${amount}`,
            system: true,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `live_id=eq.${liveId}` },
        () => {
          void fetchLiveSales(liveId).then(setSales);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `live_id=eq.${liveId}` },
        () => {
          void fetchLiveSales(liveId).then(setSales);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_gifts", filter: `live_id=eq.${liveId}` },
        (payload) => {
          void fetchLiveGiftsTotal(liveId).then(setGifts);
          const row = payload.new as GiftDbRow | undefined;
          if (row?.id) void ingestGiftRowRef.current(row);
        },
      )
      .subscribe();

    const ch = supabase.channel(`live:${liveId}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: identity },
      },
    });
    channelRef.current = ch;
    handleRef.current = {
      send: (event, payload) => {
        void ch.send({ type: "broadcast", event, payload });
      },
    };

    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      const p = payload as HostChatMsg;
      if (!p?.id || !p.text) return;
      pushChat(p);
    });
    ch.on("broadcast", { event: "gift" }, ({ payload }) => {
      const p = payload as {
        id?: string;
        giftKey?: string;
        senderId?: string;
        senderName?: string;
        fromName?: string;
        ts?: number;
      };
      const giftKey = String(p?.giftKey ?? "");
      if (!giftKey) return;
      ingestGiftRef.current({
        id: String(p.id ?? `${giftKey}-${p.ts ?? Date.now()}`),
        giftKey,
        senderId: p.senderId,
        senderName: String(p.senderName ?? p.fromName ?? "Viewer"),
        at: Number(p.ts ?? Date.now()),
      });
    });
    ch.on("broadcast", { event: "auction:extend" }, ({ payload }) => {
      const evt = payload as { productId?: string; deadlineMs?: number; ts?: number };
      if (!evt?.productId || !evt.deadlineMs) return;
      setAuction((cur) =>
        cur && cur.productId === evt.productId ? { ...cur, deadlineMs: Number(evt.deadlineMs) } : cur,
      );
      setLastExtensionTs(Number(evt.ts ?? Date.now()));
      setSuddenDeathTick((n) => n + 1);
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<
        string,
        Array<{ identity?: string; name?: string; host?: boolean }>
      >;
      const keys = Object.keys(state);
      setPresenceCount(Math.max(1, keys.length));
      const people: HostPresenceViewer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        const m = metas?.[0];
        if (m?.host) continue;
        const id = String(m?.identity ?? key);
        people.push({ identity: id, name: String(m?.name ?? "").trim() || id.slice(0, 8) });
      }
      setPresentViewers(people);
    });
    void ch.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await ch.track({
        identity,
        name: displayName,
        host: true,
        joined_at: Date.now(),
      });
    });

    return () => {
      handleRef.current = null;
      channelRef.current = null;
      void supabase.removeChannel(db);
      void supabase.removeChannel(ch);
    };
  }, [liveId, identity, displayName, pushChat]);

  const timeLeft = useMemo(() => {
    if (!auction) return 0;
    return Math.max(0, Math.ceil((auction.deadlineMs - nowMs) / 1000));
  }, [auction, nowMs]);

  const durationSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));

  useEffect(() => {
    const bid = lastBid;
    if (!bid || seenExtendBidRef.current === bid.ts) return;
    seenExtendBidRef.current = bid.ts;
    const current = auctionRef.current;
    if (!current || bid.productId !== current.productId) return;
    const product = productsRef.current.find((p) => p.id === current.productId);
    const round = product?.auction_round ?? current.auctionRound ?? 1;
    if (bid.auctionRound !== round) return;
    const msLeft = current.deadlineMs - Date.now();
    if (msLeft <= 0 || msLeft > AUCTION_EXTENSION_WINDOW_SECONDS * 1000) return;
    const newDeadline = Date.now() + AUCTION_EXTENSION_RESET_SECONDS * 1000;
    if (newDeadline <= current.deadlineMs) return;
    setAuction((cur) => (cur && cur.productId === current.productId ? { ...cur, deadlineMs: newDeadline } : cur));
    setLastExtensionTs(Date.now());
    setSuddenDeathTick((n) => n + 1);
    sendBroadcast("auction:extend", {
      productId: current.productId,
      deadlineMs: newDeadline,
      ts: Date.now(),
    });
    void supabase
      .from("live_products")
      .update({ auction_deadline_at: new Date(newDeadline).toISOString() })
      .eq("id", current.productId);
  }, [lastBid, sendBroadcast]);

  useEffect(() => {
    if (!auction || timeLeft > 0) return;
    const key = `${auction.productId}:${auction.auctionRound ?? 1}:${auction.deadlineMs}`;
    if (endingRef.current === key) return;
    endingRef.current = key;
    const product = productsRef.current.find((p) => p.id === auction.productId);
    const round = product?.auction_round ?? auction.auctionRound ?? 1;
    const bid = lastBidRef.current;
    // Round numbers can be stale/missing on live_bids rows: also accept any bid
    // on this product placed after the current round started.
    const lastBidMatches =
      !!bid &&
      bid.productId === auction.productId &&
      (bid.auctionRound === round || bid.ts >= auctionRoundStartTsRef.current);
    const winnerName = lastBidMatches ? bid!.bidderName : null;
    const winnerId = lastBidMatches ? bid!.bidderId : null;
    const finalPrice = product?.price ?? 0;
    const endId = `end-${auction.productId}-${round}-${auction.deadlineMs}`;
    sendBroadcast("auction:end", {
      productId: auction.productId,
      winnerId,
      winnerName,
      winnerAvatarUrl: null,
      finalPrice,
      orderId: null,
      autoPaid: false,
      auctionRound: round,
      endId,
      ts: Date.now(),
    });
    setLastEnd({
      endId,
      productId: auction.productId,
      productName: product?.name ?? null,
      winnerId,
      winnerName,
    });
    setAuction(null);
    void (async () => {
      // Sim winners have non-UUID ids ("sim:Name") the RPC would reject.
      const dbWinnerId = winnerId && !isSimBidderId(winnerId) ? winnerId : null;
      let res = await finalizeAuctionInDb({
        liveId,
        productId: auction.productId,
        winnerId: dbWinnerId,
        winnerName,
        finalPrice,
      });
      if (!res.ok) {
        await settleExpiredAuctions(liveId);
        res = await finalizeAuctionInDb({
          liveId,
          productId: auction.productId,
          winnerId: dbWinnerId,
          winnerName,
          finalPrice,
        });
      }
      if (winnerName) {
        pushChat({
          id: uid(),
          user: "",
          text: `🏆 ${winnerName} · ${finalPrice}`,
          system: true,
        });
      }
      // Reflect the adjudicated sale in the host's "Ventes" stat right away.
      void fetchLiveSales(liveId).then(setSales);
    })();
  }, [auction, timeLeft, liveId, sendBroadcast, pushChat]);

  const featured = useMemo(
    () => pickFeatured(products, auction?.productId ?? null, featuredId),
    [products, auction?.productId, featuredId],
  );

  const startAuction = useCallback(
    async (p: LiveProductRow): Promise<string | null> => {
      if (p.mode !== "auction") return null;
      if (startingRef.current) return null;
      if (auctionRef.current && auctionRef.current.productId !== p.id) {
        return "auction_already_running";
      }
      startingRef.current = true;
      endingRef.current = null;
      try {
        let res = await startAuctionInDb(p.id);
        if (!res.ok && res.error === "auction_already_running") {
          await settleExpiredAuctions(liveId);
          res = await startAuctionInDb(p.id);
        }
        if (!res.ok || !res.deadlineMs) res = await startAuctionInDb(p.id);
        if (!res.ok || !res.deadlineMs) return res.error ?? "start_failed";
        const evt: AuctionStartEvt = {
          productId: p.id,
          deadlineMs: res.deadlineMs,
          timerSec: res.timerSec ?? p.timer_seconds,
          ...(res.auctionRound != null ? { auctionRound: res.auctionRound } : {}),
        };
        setFeaturedId(p.id);
        setAuction(evt);
        setLastBid((cur) => (cur && cur.productId === p.id ? null : cur));
        sendBroadcast("auction:start", evt);
        pushChat({
          id: uid(),
          user: "",
          text: `Démarrer l'enchère — ${p.name}`,
          system: true,
        });
        return null;
      } finally {
        startingRef.current = false;
      }
    },
    [liveId, sendBroadcast, pushChat],
  );

  const toggleFixed = useCallback(async (p: LiveProductRow): Promise<string | null> => {
    if (p.mode !== "fixed") return null;
    setFeaturedId(p.id);
    if (p.status === "active") {
      const res = await stopFixedInDb(p.id);
      return res.ok ? null : res.error ?? "error";
    }
    const res = await activateFixedInDb(p.id);
    return res.ok ? null : res.error ?? "error";
  }, []);

  const sendChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const evt: HostChatMsg = {
        id: uid(),
        user: displayName,
        text: trimmed,
        isHost: true,
      };
      pushChat(evt);
      sendBroadcast("chat", { ...evt, source: "kidi", userId: identity });
    },
    [displayName, identity, pushChat, sendBroadcast],
  );

  const addDraft = useCallback(
    async (draft: LiveDraftProduct, userId: string) => {
      return createLiveProductFromDraft({ liveId, userId, draft });
    },
    [liveId],
  );

  /** Pre-launch crowd: overlay viewer pill (host broadcasts, viewers apply). */
  const broadcastSimViewers = useCallback(
    (count: number) => {
      const n = Math.max(1, Math.round(Number(count) || 1));
      setSimViewers(n);
      sendBroadcast("sim:viewers", { count: n });
    },
    [sendBroadcast],
  );

  /** Pre-launch crowd: visual-only bid (never written to live_bids). */
  const broadcastSimBid = useCallback(
    (evt: {
      productId: string;
      bidderId: string;
      bidderName: string;
      amount: number;
      auctionRound: number;
    }) => {
      setLastBid((cur) => {
        // Never mask a real bid with a fake one on the same product.
        if (cur && cur.productId === evt.productId && !isSimBidderId(cur.bidderId) && cur.amount >= evt.amount) {
          return cur;
        }
        return { ...evt, ts: Date.now() };
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === evt.productId ? { ...p, price: Math.max(Number(p.price) || 0, evt.amount) } : p,
        ),
      );
      pushChat({ id: uid(), user: "", text: `🔨 ${evt.bidderName} · ${evt.amount}`, system: true });
      sendBroadcast("sim:bid", evt);
    },
    [sendBroadcast, pushChat],
  );

  /** Pre-launch crowd: inject a fake chat line locally + to real viewers. */
  const ingestSimChat = useCallback(
    (evt: HostChatMsg & { color?: string; systemKind?: string }) => {
      if (!evt?.id || !evt.text?.trim()) return;
      pushChat(evt);
      sendBroadcast("chat", evt as unknown as Record<string, unknown>);
    },
    [pushChat, sendBroadcast],
  );

  return {
    products,
    featured,
    setFeaturedId,
    auction,
    timeLeft,
    lastBid,
    suddenDeathTick,
    lastExtensionTs,
    chat,
    sendChat,
    presenceCount,
    presentViewers,
    sales,
    gifts,
    lastGift,
    durationSec,
    currency,
    startAuction,
    toggleFixed,
    addDraft,
    lastEnd,
    simViewers,
    broadcastSimViewers,
    broadcastSimBid,
    ingestSimChat,
  };
}

export type HostLiveSession = ReturnType<typeof useHostLiveSession>;
