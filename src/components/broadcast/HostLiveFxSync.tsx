import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/react-native";
import { RoomEvent } from "livekit-client";
import { useFilter } from "../../lib/filters/filter-context";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
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

/**
 * Uploads local poster/background images, then publishes the FX payload on
 * LiveKit data so viewers reconstruct the same overlay.
 */
export function HostLiveFxSync({ userId }: { userId: string }) {
  const room = useRoomContext();
  const effects = useLiveEffects();
  const { activeLens } = useFilter();
  const [posterRemote, setPosterRemote] = useState<string | null>(null);
  const [bgRemote, setBgRemote] = useState<string | null>(null);
  const lastSentRef = useRef<LiveFxPayload>(EMPTY_LIVE_FX);

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
      void room.localParticipant
        .publishData(encodeLiveFx(next), { reliable: true, topic: LIVE_FX_TOPIC })
        .catch(() => undefined);
    };

    if (!liveFxEquals(payload, lastSentRef.current)) {
      send(payload);
    }

    const beat = setInterval(() => {
      void room.localParticipant
        .publishData(encodeLiveFx(lastSentRef.current), {
          reliable: true,
          topic: LIVE_FX_TOPIC,
        })
        .catch(() => undefined);
    }, LIVE_FX_HEARTBEAT_MS);

    const onJoin = () => send(lastSentRef.current);
    room.on(RoomEvent.ParticipantConnected, onJoin);

    return () => {
      clearInterval(beat);
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [
    room,
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
