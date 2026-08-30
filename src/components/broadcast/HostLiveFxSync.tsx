import { useEffect, useRef, useState } from "react";
import { useFilter } from "../../lib/filters/filter-context";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
import {
  createLiveFxHostTransport,
  type LiveFxHostTransport,
} from "../../lib/live-fx-broadcast";
import {
  EMPTY_LIVE_FX,
  LIVE_FX_HEARTBEAT_MS,
  LIVE_FX_TOPIC,
  encodeLiveFx,
  isLocalImageUri,
  isPublishableImageUrl,
  liveFxEquals,
  liveTintForLens,
  sanitizeLiveFx,
  type LiveFxPayload,
} from "../../lib/live-fx";
import { uploadLiveOverlayImage } from "../../lib/lives";

type LiveKitPublisher = {
  publishData: (
    data: Uint8Array,
    options?: { reliable?: boolean; topic?: string },
  ) => Promise<void> | void;
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
};

/**
 * Uploads local poster/background images, then publishes the FX payload so
 * viewers reconstruct the same overlay (Supabase + LiveKit when available).
 */
export function HostLiveFxSync({
  liveId,
  userId,
  liveKit,
}: {
  liveId: string;
  userId: string;
  liveKit?: LiveKitPublisher | null;
}) {
  const effects = useLiveEffects();
  const { activeLens } = useFilter();
  const [posterRemote, setPosterRemote] = useState<string | null>(null);
  const [bgRemote, setBgRemote] = useState<string | null>(null);
  const lastSentRef = useRef<LiveFxPayload>(EMPTY_LIVE_FX);
  const transportRef = useRef<LiveFxHostTransport | null>(null);

  useEffect(() => {
    const transport = createLiveFxHostTransport(liveId, () => {
      transport.send(lastSentRef.current);
    });
    transportRef.current = transport;
    return () => {
      transportRef.current = null;
      transport.close();
    };
  }, [liveId]);

  useEffect(() => {
    let cancelled = false;
    const local = effects.posterUrl;
    if (!local || effects.posterMode === "off") {
      setPosterRemote(null);
      return;
    }
    if (isPublishableImageUrl(local)) {
      setPosterRemote(local);
      return;
    }
    if (!isLocalImageUri(local) || !userId) {
      return;
    }
    void uploadLiveOverlayImage(userId, local)
      .then((remote) => {
        if (!cancelled) setPosterRemote(remote);
      })
      .catch(() => {
        if (!cancelled) setPosterRemote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [effects.posterUrl, effects.posterMode, userId]);

  useEffect(() => {
    let cancelled = false;
    const local = effects.backgroundUrl;
    if (!local || effects.backgroundMode !== "image") {
      setBgRemote(null);
      return;
    }
    if (isPublishableImageUrl(local)) {
      setBgRemote(local);
      return;
    }
    if (!isLocalImageUri(local) || !userId) {
      return;
    }
    void uploadLiveOverlayImage(userId, local)
      .then((remote) => {
        if (!cancelled) setBgRemote(remote);
      })
      .catch(() => {
        if (!cancelled) setBgRemote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [effects.backgroundUrl, effects.backgroundMode, userId]);

  useEffect(() => {
    const payload = sanitizeLiveFx({
      posterUrl: posterRemote,
      posterMode: effects.posterMode,
      posterX: effects.posterTransform.x,
      posterY: effects.posterTransform.y,
      posterScale: effects.posterTransform.scale,
      backgroundMode: effects.backgroundMode,
      backgroundUrl: bgRemote,
      lensId: activeLens.lensId,
      lensName: activeLens.name,
      tint: liveTintForLens(activeLens),
    });

    const send = (next: LiveFxPayload) => {
      lastSentRef.current = next;
      transportRef.current?.send(next);
      if (!liveKit) return;
      const bytes = encodeLiveFx(next);
      void Promise.resolve(
        liveKit.publishData(bytes, { reliable: true, topic: LIVE_FX_TOPIC }),
      ).catch(() => undefined);
      void Promise.resolve(liveKit.publishData(bytes, { reliable: true })).catch(() => undefined);
    };

    if (!liveFxEquals(payload, lastSentRef.current)) {
      send(payload);
    }

    const beat = setInterval(() => send(lastSentRef.current), LIVE_FX_HEARTBEAT_MS);
    const onJoin = () => send(lastSentRef.current);
    liveKit?.on?.("participantConnected", onJoin);

    return () => {
      clearInterval(beat);
      liveKit?.off?.("participantConnected", onJoin);
    };
  }, [
    liveId,
    liveKit,
    posterRemote,
    bgRemote,
    effects.posterMode,
    effects.posterTransform.x,
    effects.posterTransform.y,
    effects.posterTransform.scale,
    effects.backgroundMode,
    activeLens.lensId,
    activeLens.name,
    activeLens.tint,
    activeLens.isSnapLens,
  ]);

  return null;
}
