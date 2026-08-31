// Host-side bridge: poll YouTube / Facebook comments → KiDi+ room chat.
// Same /api/social-chat/* as the website.

import { useEffect, useRef } from "react";
import { kidiplusJson } from "./kidiplus-api";
import {
  markSocialSeen,
  socialMessagesToEvents,
  socialPromoText,
  type SocialChatEvt,
  type SocialMsg,
} from "./social-chat-logic";

export { socialMessagesToEvents, socialPromoText, type SocialChatEvt } from "./social-chat-logic";

const PROMO_INTERVAL_MS = 4 * 60_000;

export async function replyOnSocialPlatforms(opts: {
  liveId: string;
  text: string;
  source?: "youtube" | "facebook" | "all";
  parentExternalId?: string;
}): Promise<void> {
  const res = await kidiplusJson<{
    results?: {
      youtube?: { ok: boolean; id?: string };
      facebook?: { ok: boolean; id?: string };
    };
  }>("/api/social-chat/reply", {
    method: "POST",
    body: {
      liveId: opts.liveId,
      text: opts.text,
      source: opts.source ?? "all",
      ...(opts.parentExternalId ? { parentExternalId: opts.parentExternalId } : {}),
    },
  });
  if (!res.ok) throw new Error(res.error);
  if (res.data.results?.youtube?.ok && res.data.results.youtube.id) {
    markSocialSeen(`yt:${res.data.results.youtube.id}`);
  }
  if (res.data.results?.facebook?.ok && res.data.results.facebook.id) {
    markSocialSeen(`fb:${res.data.results.facebook.id}`);
  }
}

export async function pollSocialChat(opts: {
  liveId: string;
  youtubePageToken?: string | null;
}): Promise<{
  youtube: { messages: SocialMsg[]; nextPageToken: string | null; pollingIntervalMs?: number };
  facebook: { messages: SocialMsg[] };
}> {
  const res = await kidiplusJson<{
    youtube?: {
      messages?: SocialMsg[];
      nextPageToken?: string | null;
      pollingIntervalMs?: number;
    } | null;
    facebook?: { messages?: SocialMsg[] } | null;
  }>("/api/social-chat/poll", {
    method: "POST",
    body: {
      liveId: opts.liveId,
      youtubePageToken: opts.youtubePageToken ?? null,
    },
  });
  if (!res.ok) {
    return {
      youtube: { messages: [], nextPageToken: opts.youtubePageToken ?? null },
      facebook: { messages: [] },
    };
  }
  return {
    youtube: {
      messages: res.data.youtube?.messages ?? [],
      nextPageToken: res.data.youtube?.nextPageToken ?? opts.youtubePageToken ?? null,
      pollingIntervalMs: res.data.youtube?.pollingIntervalMs,
    },
    facebook: { messages: res.data.facebook?.messages ?? [] },
  };
}

/**
 * While YouTube and/or Facebook restream is ON, pull remote comments into
 * the KiDi+ chat (with source badges) so the host can see and answer them.
 */
export function useSocialChatBridge(opts: {
  liveId: string | null | undefined;
  enabledYoutube: boolean;
  enabledFacebook: boolean;
  ingestExternalChat: (evt: SocialChatEvt) => void;
  auctionActive?: boolean;
  productName?: string | null;
}) {
  const {
    liveId,
    enabledYoutube,
    enabledFacebook,
    ingestExternalChat,
    auctionActive = false,
    productName = null,
  } = opts;
  const ytPageTokenRef = useRef<string | null>(null);
  const ingestRef = useRef(ingestExternalChat);
  ingestRef.current = ingestExternalChat;
  const auctionActiveRef = useRef(auctionActive);
  auctionActiveRef.current = auctionActive;
  const productNameRef = useRef(productName);
  productNameRef.current = productName;
  const lastPromoAtRef = useRef(0);
  const lastAuctionPromoKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!liveId || (!enabledYoutube && !enabledFacebook)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delayMs = 4000;

    const tick = async () => {
      if (cancelled) return;
      try {
        const body = await pollSocialChat({
          liveId,
          youtubePageToken: ytPageTokenRef.current,
        });
        if (body.youtube.nextPageToken) ytPageTokenRef.current = body.youtube.nextPageToken;
        if (typeof body.youtube.pollingIntervalMs === "number") {
          delayMs = Math.min(15_000, Math.max(3500, body.youtube.pollingIntervalMs));
        }
        for (const evt of socialMessagesToEvents(body)) {
          ingestRef.current(evt);
        }
      } catch {
        delayMs = Math.min(15_000, delayMs + 1000);
      }
      if (!cancelled) timer = setTimeout(() => void tick(), delayMs);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [liveId, enabledYoutube, enabledFacebook]);

  useEffect(() => {
    if (!liveId || (!enabledYoutube && !enabledFacebook)) return;
    let cancelled = false;

    const postPromo = async (force = false) => {
      if (cancelled) return;
      const now = Date.now();
      if (!force && now - lastPromoAtRef.current < PROMO_INTERVAL_MS) return;
      lastPromoAtRef.current = now;
      try {
        await replyOnSocialPlatforms({
          liveId,
          text: socialPromoText(productNameRef.current, auctionActiveRef.current),
          source: "all",
        });
      } catch {
        /* promo is best-effort */
      }
    };

    const first = setTimeout(() => void postPromo(true), 12_000);
    const interval = setInterval(() => void postPromo(false), 60_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [liveId, enabledYoutube, enabledFacebook]);

  useEffect(() => {
    if (!liveId || (!enabledYoutube && !enabledFacebook)) return;
    if (!auctionActive || !productName) return;
    const key = `${productName}:${auctionActive}`;
    if (lastAuctionPromoKeyRef.current === key) return;
    lastAuctionPromoKeyRef.current = key;
    const timer = setTimeout(() => {
      void replyOnSocialPlatforms({
        liveId,
        text: socialPromoText(productName, true),
        source: "all",
      }).catch(() => undefined);
    }, 2500);
    return () => clearTimeout(timer);
  }, [liveId, enabledYoutube, enabledFacebook, auctionActive, productName]);
}
