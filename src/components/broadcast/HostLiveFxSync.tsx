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
  overlayPosterForViewers,
  sanitizeLiveFx,
  type LiveFxPayload,
} from "../../lib/live-fx";
import { uploadLiveOverlayImageWithRetry } from "../../lib/lives";

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
  bakedBackground = false,
}: {
  liveId: string;
  userId: string;
  liveKit?: LiveKitPublisher | null;
  /** Green screen already in the published pixels — poster stays an overlay. */
  bakedBackground?: boolean;
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
    const already = effects.posterPublishedUrl;
    if (!local || effects.posterMode === "off") {
      setPosterRemote(null);
      return;
    }
    if (isPublishableImageUrl(already)) {
      setPosterRemote(already);
      return;
    }
    if (isPublishableImageUrl(local)) {
      setPosterRemote(local);
      return;
    }
    if (!isLocalImageUri(local) || !userId) {
      console.warn("[LiveFx] poster not uploadable", {
        local: String(effects.posterUrl ?? "").slice(0, 48),
        userId: !!userId,
      });
      return;
    }
    const startFallback = () => {
      void uploadLiveOverlayImageWithRetry(userId, local)
        .then((remote) => {
          if (cancelled) return;
          if (!isPublishableImageUrl(remote)) {
            console.warn("[LiveFx] retry upload returned a non-https URL");
            setPosterRemote(null);
            return;
          }
          setPosterRemote(remote);
        })
        .catch((err) => {
          console.warn("[LiveFx] viewer poster upload failed", err);
          if (!cancelled) setPosterRemote(null);
        });
    };
    // The picker already started an upload. Wait briefly before a 2nd try.
    const wait = setTimeout(startFallback, 2_500);
    return () => {
      cancelled = true;
      clearTimeout(wait);
    };
  }, [effects.posterUrl, effects.posterPublishedUrl, effects.posterMode, userId]);

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
    void uploadLiveOverlayImageWithRetry(userId, local)
      .then((remote) => {
        if (!cancelled && isPublishableImageUrl(remote)) setBgRemote(remote);
      })
      .catch((err) => {
        console.warn("[LiveFx] background upload failed", err);
        if (!cancelled) setBgRemote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [effects.backgroundUrl, effects.backgroundMode, userId]);

  useEffect(() => {
    const poster = overlayPosterForViewers({
      posterMode: effects.posterMode,
      remoteUrl: posterRemote,
    });
    const payload = sanitizeLiveFx({
      posterUrl: poster.posterUrl,
      posterMode: poster.posterMode,
      posterX: effects.posterTransform.x,
      posterY: effects.posterTransform.y,
      posterScale: effects.posterTransform.scale,
      backgroundMode: bakedBackground ? "none" : effects.backgroundMode,
      backgroundUrl: bakedBackground ? null : bgRemote,
      lensId: activeLens.lensId,
      lensName: activeLens.name,
      tint: liveTintForLens(activeLens),
    });

    const send = (next: LiveFxPayload) => {
      lastSentRef.current = next;
      transportRef.current?.send(next);
      if (!liveKit) return;
      const bytes = encodeLiveFx(next);
      // Codex: publishData can throw sync while LiveKit reconnects (red screen).
      void Promise.resolve()
        .then(() => liveKit.publishData(bytes, { reliable: true, topic: LIVE_FX_TOPIC }))
        .catch(() => undefined);
      void Promise.resolve()
        .then(() => liveKit.publishData(bytes, { reliable: true }))
        .catch(() => undefined);
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
    bakedBackground,
  ]);

  return null;
}
