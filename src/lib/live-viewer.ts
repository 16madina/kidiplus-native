import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  fetchLiveProducts,
  pickFeatured,
  type AuctionEndReveal,
  type AuctionStartEvt,
  type HostChatMsg,
  type LastBidEvt,
  type LiveProductRow,
} from "./live-host";
import { sendGift as sendGiftRpc, type GiftKey } from "./gifts";
import { nextBidAmount, normalizeCurrency, type Currency } from "./money";
import {
  EMPTY_LIVE_FX,
  LIVE_FX_EVENT,
  LIVE_FX_REQUEST_EVENT,
  liveFxChannelName,
  sanitizeLiveFx,
  type LiveFxPayload,
} from "./live-fx";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function auctionFromRow(row: LiveProductRow): AuctionStartEvt | null {
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

export type ViewerRoomState = {
  liveStatus: "live" | "ended" | "scheduled" | "unknown";
  currency: Currency;
  products: LiveProductRow[];
  featured: LiveProductRow | null;
  auction: AuctionStartEvt | null;
  timeLeft: number;
  suddenDeathTick: number;
  lastBid: LastBidEvt | null;
  chat: HostChatMsg[];
  viewers: number;
  lastReveal: AuctionEndReveal | null;
  lastGift: { id?: string; giftKey: GiftKey; fromName: string; at: number } | null;
  fx: LiveFxPayload;
  heartPulse: number;
  loading: boolean;
  error: string | null;
};

export type ViewerActions = {
  sendChat: (text: string) => Promise<void>;
  sendHeart: () => void;
  placeBid: (opts?: {
    amount?: number;
    productId?: string;
  }) => Promise<{ ok: true; amount: number } | { ok: false; error: string; minNext?: number }>;
  buyNow: (opts?: {
    productId?: string;
    color?: string | null;
    size?: string | null;
  }) => Promise<{ ok: true; orderId: string } | { ok: false; error: string }>;
  sendGift: (giftKey: GiftKey) => Promise<{ ok: true } | { ok: false; error: string }>;
  refreshProducts: () => Promise<void>;
  clearReveal: () => void;
};

export function useViewerLiveRoom(
  liveId: string | undefined,
  opts: { displayName: string; userId: string | null; identity: string },
): ViewerRoomState & ViewerActions {
  const [liveStatus, setLiveStatus] = useState<ViewerRoomState["liveStatus"]>("unknown");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [products, setProducts] = useState<LiveProductRow[]>([]);
  const [auction, setAuction] = useState<AuctionStartEvt | null>(null);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [lastBid, setLastBid] = useState<LastBidEvt | null>(null);
  const [suddenDeathTick, setSuddenDeathTick] = useState(0);
  const [chat, setChat] = useState<HostChatMsg[]>([]);
  const [viewers, setViewers] = useState(0);
  const [lastReveal, setLastReveal] = useState<AuctionEndReveal | null>(null);
  const [fx, setFx] = useState<LiveFxPayload>(EMPTY_LIVE_FX);
  const [lastGift, setLastGift] = useState<ViewerRoomState["lastGift"]>(null);
  const [heartPulse, setHeartPulse] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const displayNameRef = useRef(opts.displayName);
  displayNameRef.current = opts.displayName;
  const seenGiftIdsRef = useRef<Set<string>>(new Set());
  const seenActiveAuctionRef = useRef<Set<string>>(new Set());
  const lastBidRef = useRef<LastBidEvt | null>(null);
  lastBidRef.current = lastBid;

  const featured = useMemo(
    () => pickFeatured(products, auction?.productId ?? null, featuredId),
    [products, auction?.productId, featuredId],
  );

  const timeLeft = useMemo(() => {
    if (!auction) return 0;
    return Math.max(0, Math.ceil((auction.deadlineMs - nowMs) / 1000));
  }, [auction, nowMs]);

  const pushChat = useCallback((msg: HostChatMsg) => {
    setChat((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      const next = [...prev, msg];
      return next.length > 150 ? next.slice(next.length - 150) : next;
    });
  }, []);

  const ingestGift = useCallback(
    (evt: { id: string; giftKey: GiftKey; fromName: string; at: number }) => {
      if (!evt.id || !evt.giftKey) return;
      if (seenGiftIdsRef.current.has(evt.id)) return;
      if (evt.at && Date.now() - evt.at > 5 * 60_000) return;
      seenGiftIdsRef.current.add(evt.id);
      if (seenGiftIdsRef.current.size > 200) {
        const arr = Array.from(seenGiftIdsRef.current);
        seenGiftIdsRef.current = new Set(arr.slice(arr.length - 100));
      }
      setLastGift(evt);
      pushChat({
        id: `gift-${evt.id}`,
        user: evt.fromName,
        text: `🎁 ${evt.giftKey}`,
      });
    },
    [pushChat],
  );

  const ingestGiftRef = useRef(ingestGift);
  ingestGiftRef.current = ingestGift;

  const refreshProducts = useCallback(async () => {
    if (!liveId) return;
    try {
      const rows = await fetchLiveProducts(liveId);
      setProducts(rows);
      const running = rows.find((r) => auctionFromRow(r));
      if (running) {
        seenActiveAuctionRef.current.add(running.id);
        const start = auctionFromRow(running);
        if (start) {
          setAuction(start);
          setFeaturedId(running.id);
        }
      }
      for (const row of rows) {
        if (row.mode !== "auction") continue;
        if (row.status !== "sold" && row.status !== "unsold") continue;
        if (!seenActiveAuctionRef.current.has(row.id)) continue;
        seenActiveAuctionRef.current.delete(row.id);
        const winnerId = row.sold_to_identity;
        let winnerName: string | null = null;
        if (row.status === "sold" && winnerId) {
          const bid = lastBidRef.current;
          winnerName =
            bid && bid.bidderId === winnerId ? bid.bidderName : null;
          if (!winnerName) {
            const { data } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", winnerId)
              .maybeSingle();
            winnerName =
              (data as { display_name?: string | null } | null)?.display_name?.trim() ||
              "Gagnant";
          }
        }
        setLastReveal({
          endId: `db-${row.id}-${row.status}-${row.auction_round ?? 1}`,
          productId: row.id,
          productName: row.name ?? null,
          winnerId: row.status === "sold" ? winnerId : null,
          winnerName: row.status === "sold" ? winnerName : null,
        });
        setAuction((cur) => (cur && cur.productId === row.id ? null : cur));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Produits indisponibles");
    }
  }, [liveId]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!liveId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const { data: live } = await supabase
          .from("lives")
          .select("id,status,current_viewers,currency")
          .eq("id", liveId)
          .maybeSingle();
        if (cancelled) return;
        const st = String((live as { status?: string } | null)?.status ?? "unknown");
        setLiveStatus(st === "live" || st === "ended" || st === "scheduled" ? st : "unknown");
        setViewers(Number((live as { current_viewers?: number } | null)?.current_viewers ?? 0));
        if ((live as { currency?: string } | null)?.currency) {
          setCurrency(normalizeCurrency((live as { currency: string }).currency));
        }
        await refreshProducts();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur live");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liveId, refreshProducts]);

  useEffect(() => {
    if (!liveId) return;

    const channel = supabase.channel(`live:${liveId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: opts.identity },
      },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        const p = payload as HostChatMsg;
        if (!p?.id || !p.text) return;
        pushChat(p);
      })
      .on("broadcast", { event: "heart" }, () => {
        setHeartPulse((n) => n + 1);
      })
      .on("broadcast", { event: "join" }, ({ payload }) => {
        const p = payload as { name?: string };
        if (!p?.name) return;
        pushChat({
          id: `join-${uid()}`,
          user: "",
          text: `${p.name} a rejoint`,
          system: true,
        });
      })
      .on("broadcast", { event: "gift" }, ({ payload }) => {
        const p = payload as {
          id?: string;
          giftKey?: string;
          senderName?: string;
          fromName?: string;
          ts?: number;
        };
        const giftKey = String(p?.giftKey ?? "") as GiftKey;
        if (!giftKey) return;
        const fromName = String(p.senderName ?? p.fromName ?? "Viewer");
        ingestGiftRef.current({
          id: String(p.id ?? `${giftKey}-${p.ts ?? Date.now()}`),
          giftKey,
          fromName,
          at: Number(p.ts ?? Date.now()),
        });
      })
      .on("broadcast", { event: "auction:start" }, ({ payload }) => {
        const p = payload as AuctionStartEvt;
        if (!p?.productId || !p.deadlineMs) return;
        setAuction({
          productId: String(p.productId),
          deadlineMs: Number(p.deadlineMs),
          timerSec: Number(p.timerSec ?? 30),
          ...(p.auctionRound != null ? { auctionRound: Number(p.auctionRound) } : {}),
        });
        setFeaturedId(String(p.productId));
        setLastBid(null);
        setSuddenDeathTick(0);
        void refreshProducts();
      })
      .on("broadcast", { event: "auction:extend" }, ({ payload }) => {
        const p = payload as { productId?: string; deadlineMs?: number };
        if (!p?.productId || !p.deadlineMs) return;
        setAuction((cur) =>
          cur && cur.productId === p.productId ? { ...cur, deadlineMs: Number(p.deadlineMs) } : cur,
        );
        setSuddenDeathTick((n) => n + 1);
      })
      .on("broadcast", { event: LIVE_FX_EVENT }, ({ payload }) => {
        setFx(sanitizeLiveFx(payload as Partial<LiveFxPayload>));
      })
      .on("broadcast", { event: "auction:end" }, ({ payload }) => {
        const p = payload as {
          productId?: string;
          winnerId?: string | null;
          winnerName?: string | null;
          endId?: string;
          productName?: string | null;
          auctionRound?: number;
        };
        if (!p?.productId) return;
        setLastReveal({
          endId: String(p.endId ?? `end-${p.productId}-${Date.now()}`),
          productId: String(p.productId),
          productName: p.productName ?? null,
          winnerId: p.winnerId != null ? String(p.winnerId) : null,
          winnerName: p.winnerName != null ? String(p.winnerName) : null,
        });
        setAuction((cur) => (cur && cur.productId === p.productId ? null : cur));
        void refreshProducts();
      })
      .on("broadcast", { event: "sim:viewers" }, ({ payload }) => {
        const n = Number((payload as { count?: number })?.count);
        if (Number.isFinite(n) && n >= 0) setViewers(n);
      })
      .on("broadcast", { event: "sim:bid" }, ({ payload }) => {
        const p = payload as LastBidEvt;
        if (p?.productId && p.amount != null) {
          setLastBid({
            productId: String(p.productId),
            bidderId: String(p.bidderId ?? "sim"),
            bidderName: String(p.bidderName ?? "Sim"),
            amount: Number(p.amount),
            ts: Number(p.ts ?? Date.now()),
            auctionRound: Number(p.auctionRound ?? 1),
          });
          setProducts((prev) =>
            prev.map((row) => (row.id === p.productId ? { ...row, price: Number(p.amount) } : row)),
          );
        }
        void refreshProducts();
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const n = Object.keys(state).length;
        if (n > 0) setViewers(n);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({
          identity: opts.identity,
          name: displayNameRef.current || "Viewer",
          host: false,
          joined_at: Date.now(),
        });
        void channel.send({
          type: "broadcast",
          event: "join",
          payload: { name: displayNameRef.current || "Viewer", at: Date.now() },
        });
        void channel.send({
          type: "broadcast",
          event: LIVE_FX_REQUEST_EVENT,
          payload: { identity: opts.identity, at: Date.now() },
        });
      });

    const fxCh = supabase
      .channel(liveFxChannelName(liveId), {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: LIVE_FX_EVENT }, ({ payload }) => {
        setFx(sanitizeLiveFx(payload as Partial<LiveFxPayload>));
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void fxCh.send({
          type: "broadcast",
          event: LIVE_FX_REQUEST_EVENT,
          payload: { identity: opts.identity, at: Date.now() },
        });
      });

    const productsCh = supabase
      .channel(`viewer-products-${liveId}-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_products", filter: `live_id=eq.${liveId}` },
        () => {
          void refreshProducts();
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
          if (!row?.product_id) {
            void refreshProducts();
            return;
          }
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
      .subscribe();

    const liveCh = supabase
      .channel(`viewer-live-row-${liveId}-${uid()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lives", filter: `id=eq.${liveId}` },
        (payload) => {
          const row = payload.new as { status?: string; current_viewers?: number; currency?: string };
          const st = String(row.status ?? "");
          if (st === "ended" || st === "live" || st === "scheduled") setLiveStatus(st);
          if (typeof row.current_viewers === "number") setViewers(row.current_viewers);
          if (row.currency) setCurrency(normalizeCurrency(row.currency));
        },
      )
      .subscribe();

    // Durable backup if ephemeral broadcast is dropped (same as web / host).
    const giftsCh = supabase
      .channel(`viewer-gifts-${liveId}-${uid()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_gifts", filter: `live_id=eq.${liveId}` },
        (payload) => {
          const row = payload.new as {
            id?: string;
            sender_id?: string;
            gift_key?: string;
            created_at?: string | null;
          };
          if (!row?.id || !row.gift_key) return;
          void (async () => {
            let fromName = "Viewer";
            if (row.sender_id) {
              try {
                const { data } = await supabase
                  .from("profiles")
                  .select("display_name, handle")
                  .eq("id", row.sender_id)
                  .maybeSingle();
                fromName =
                  (data as { display_name?: string | null; handle?: string | null } | null)?.display_name?.trim() ||
                  (data as { handle?: string | null } | null)?.handle?.trim() ||
                  fromName;
              } catch {
                /* best-effort */
              }
            }
            ingestGiftRef.current({
              id: row.id!,
              giftKey: row.gift_key as GiftKey,
              fromName,
              at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            });
          })();
        },
      )
      .subscribe();

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
      void supabase.removeChannel(productsCh);
      void supabase.removeChannel(liveCh);
      void supabase.removeChannel(giftsCh);
      void supabase.removeChannel(fxCh);
      channelRef.current = null;
    };
  }, [liveId, opts.identity, pushChat, refreshProducts]);

  useEffect(() => {
    seenGiftIdsRef.current = new Set();
    seenActiveAuctionRef.current = new Set();
    setLastGift(null);
    setFx(EMPTY_LIVE_FX);
  }, [liveId]);

  const sendChat = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || !channelRef.current) return;
    const msg: HostChatMsg = {
      id: uid(),
      user: displayNameRef.current || "Viewer",
      text: t.slice(0, 200),
    };
    pushChat(msg);
    await channelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
  }, [pushChat]);

  const sendHeart = useCallback(() => {
    setHeartPulse((n) => n + 1);
    void channelRef.current?.send({
      type: "broadcast",
      event: "heart",
      payload: { at: Date.now() },
    });
  }, []);

  const placeBid = useCallback(
    async (bidOpts?: { amount?: number; productId?: string }) => {
      if (!liveId) return { ok: false as const, error: "Live introuvable" };
      const productId = bidOpts?.productId ?? auction?.productId ?? featured?.id;
      if (!productId) return { ok: false as const, error: "Aucune enchère en cours" };
      const product = products.find((p) => p.id === productId) ?? featured;
      if (!product || product.mode !== "auction") {
        return { ok: false as const, error: "Aucune enchère en cours" };
      }
      const amount =
        bidOpts?.amount ?? nextBidAmount(Number(product.price ?? product.start_price ?? 0), currency);
      // Server rejects when the seller does not ship to the buyer (resolve_buyer_delivery).
      const { data, error: rpcErr } = await supabase.rpc("place_live_bid", {
        _live_id: liveId,
        _product_id: productId,
        _bidder_name: displayNameRef.current || "Viewer",
        _amount: amount,
      } as never);
      if (rpcErr) return { ok: false as const, error: rpcErr.message };
      const payload = data as {
        ok?: boolean;
        error?: string;
        amount?: number;
        min_next?: number;
      } | null;
      if (payload && payload.ok === false) {
        return {
          ok: false as const,
          error: String(payload.error ?? "Enchère refusée"),
          minNext: payload.min_next != null ? Number(payload.min_next) : undefined,
        };
      }
      void refreshProducts();
      return { ok: true as const, amount: Number(payload?.amount ?? amount) };
    },
    [liveId, auction?.productId, featured, products, currency, refreshProducts],
  );

  const buyNow = useCallback(
    async (buyOpts?: { productId?: string; color?: string | null; size?: string | null }) => {
      const productId = buyOpts?.productId ?? featured?.id;
      if (!productId) return { ok: false as const, error: "Aucun produit" };
      // Server also calls resolve_buyer_delivery before creating the order.
      const { data, error: rpcErr } = await supabase.rpc("create_live_order", {
        _product_id: productId,
        _kind: "fixed",
        _color: buyOpts?.color ?? null,
        _size: buyOpts?.size ?? null,
      } as never);
      if (rpcErr) return { ok: false as const, error: rpcErr.message };
      const payload = data as {
        ok?: boolean;
        order_id?: string;
        order?: { id?: string };
        error?: string;
      } | null;
      const orderId = payload?.order_id ?? payload?.order?.id;
      if (!payload?.ok || !orderId) {
        return { ok: false as const, error: String(payload?.error ?? "Achat impossible") };
      }
      void refreshProducts();
      return { ok: true as const, orderId: String(orderId) };
    },
    [featured, refreshProducts],
  );

  const sendGift = useCallback(
    async (giftKey: GiftKey) => {
      if (!liveId) return { ok: false as const, error: "Live introuvable" };
      const res = await sendGiftRpc(liveId, giftKey);
      if (!res.ok) return { ok: false as const, error: res.error };
      const fromName = res.senderName || displayNameRef.current || "Viewer";
      const at = Date.now();
      ingestGiftRef.current({
        id: String(res.giftId),
        giftKey,
        fromName,
        at,
      });
      void channelRef.current?.send({
        type: "broadcast",
        event: "gift",
        payload: {
          id: res.giftId,
          giftKey,
          senderId: opts.userId,
          senderName: fromName,
          ts: at,
        },
      });
      return { ok: true as const };
    },
    [liveId, opts.userId],
  );

  const clearReveal = useCallback(() => setLastReveal(null), []);

  return {
    liveStatus,
    currency,
    products,
    featured,
    auction,
    timeLeft,
    suddenDeathTick,
    lastBid,
    chat,
    viewers,
    lastReveal,
    fx,
    lastGift,
    heartPulse,
    loading,
    error,
    sendChat,
    sendHeart,
    placeBid,
    buyNow,
    sendGift,
    refreshProducts,
    clearReveal,
  };
}
