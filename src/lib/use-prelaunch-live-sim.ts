import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { nextBidAmount, normalizeCurrency } from "./money";
import {
  DEFAULT_PRELAUNCH_LIVE_SIM,
  fetchPrelaunchLiveSimConfig,
  initialSimViewerCount,
  isSimBidderId,
  nextBidDelayMs,
  nextCommentDelayMs,
  nextSimViewerCount,
  nextViewerTickMs,
  randomSimChat,
  randomSimName,
  simBidderId,
  type PrelaunchLiveSimConfig,
} from "./prelaunch-live-sim";
import type { HostLiveSession } from "./live-host";

/** Host-only fake crowd for pre-launch filming. Driven by admin « Simu » config. */
export function useHostPrelaunchSim(session: HostLiveSession, currency: string) {
  const [cfg, setCfg] = useState<PrelaunchLiveSimConfig>({ ...DEFAULT_PRELAUNCH_LIVE_SIM });
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const cur = normalizeCurrency(currency);
  const enabled = cfg.enabled;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  // Poll the admin config so toggling Simu mid-live applies within ~20s.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await fetchPrelaunchLiveSimConfig();
      if (!cancelled) setCfg(next);
    };
    void refresh();
    const id = setInterval(() => void refresh(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Viewer pill oscillating between admin min/max.
  useEffect(() => {
    if (!enabled || !appActive) return;
    const { viewersMin, viewersMax } = cfgRef.current;
    let count = initialSimViewerCount(viewersMin, viewersMax);
    let dir: 1 | -1 = 1;
    sessionRef.current.broadcastSimViewers(count);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const c = cfgRef.current;
      const next = nextSimViewerCount(count, dir, c.viewersMin, c.viewersMax);
      count = next.count;
      dir = next.dir;
      sessionRef.current.broadcastSimViewers(count);
      timer = setTimeout(tick, nextViewerTickMs());
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [enabled, appActive, cfg.viewersMin, cfg.viewersMax]);

  // Chat + join lines + occasional hearts.
  useEffect(() => {
    if (!enabled || !appActive) return;
    let seq = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const c = cfgRef.current;
      const s = sessionRef.current;
      const auctionHot = !!s.auction;
      const line = randomSimChat(auctionHot);
      seq += 1;
      if (line.join) {
        s.ingestSimChat({
          id: `sim-join-${Date.now()}-${seq}`,
          user: "",
          text: line.name,
          system: true,
          systemKind: "join",
        });
      } else {
        s.ingestSimChat({
          id: `sim-chat-${Date.now()}-${seq}`,
          user: line.name,
          text: line.text,
        });
      }
      timer = setTimeout(tick, nextCommentDelayMs(c));
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [enabled, appActive, cfg.commentEverySecMin, cfg.commentEverySecMax, cfg.heartChancePct]);

  // Fake bids on the running auction, until ~1.2s before the bell.
  const auctionProductId = session.auction?.productId ?? null;
  const auctionDeadlineMs = session.auction?.deadlineMs ?? 0;
  useEffect(() => {
    if (!enabled || !cfg.fakeBids || !appActive || !auctionProductId) return;
    let timer: ReturnType<typeof setTimeout>;
    const used = new Set<string>();
    const tick = () => {
      const c = cfgRef.current;
      if (!c.fakeBids) return;
      const s = sessionRef.current;
      const start = s.auction;
      if (!start || start.productId !== auctionProductId) return;
      const left = start.deadlineMs - Date.now();
      if (left < 1200) return;
      const product = s.products.find((p) => p.id === start.productId);
      if (!product || product.status !== "active") {
        timer = setTimeout(tick, 1200);
        return;
      }
      const last = s.lastBid;
      // Let a real bidder keep the lead for a beat before the crowd replies.
      if (last && last.productId === start.productId && !isSimBidderId(last.bidderId)) {
        timer = setTimeout(tick, 2000);
        return;
      }
      let name = randomSimName();
      if (used.has(name) && used.size < 20) {
        for (let i = 0; i < 6; i++) {
          const n = randomSimName();
          if (!used.has(n)) {
            name = n;
            break;
          }
        }
      }
      used.add(name);
      const amount = nextBidAmount(Number(product.price) || 0, cur);
      const round = Number(product.auction_round ?? start.auctionRound ?? 1);
      s.broadcastSimBid({
        productId: start.productId,
        bidderId: simBidderId(name),
        bidderName: name,
        amount,
        auctionRound: round,
      });
      timer = setTimeout(tick, nextBidDelayMs(c));
    };
    timer = setTimeout(tick, 900 + Math.random() * 700);
    return () => clearTimeout(timer);
  }, [
    enabled,
    cfg.fakeBids,
    cfg.bidEverySecMin,
    cfg.bidEverySecMax,
    appActive,
    auctionProductId,
    auctionDeadlineMs,
    cur,
  ]);
}
