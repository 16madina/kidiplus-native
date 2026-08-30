import { bootLiveKit } from "../../lib/livekit-boot";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useRoomContext,
  useTracks,
} from "@livekit/react-native";
import { RoomEvent, Track } from "livekit-client";
import { Press } from "../Press";
import { BattleSplitStage, type BattleSplitFighter } from "../battle/BattleSplitStage";
import { isBattleGuestIdentity } from "../../lib/battles";
import {
  startViewerPlaybackAudioSession,
  stopViewerPlaybackAudioSession,
} from "../../lib/live-audio-session";
import { fetchLiveKitSession } from "../../lib/livekit";
import { VIEWER_PUBLISH_MIC } from "../../lib/live-viewer-media";
import {
  EMPTY_LIVE_FX,
  LIVE_FX_TOPIC,
  decodeLiveFx,
  liveFxHasVisual,
  type LiveFxPayload,
} from "../../lib/live-fx";
import { LiveFxOverlay } from "./LiveFxOverlay";
import { GOLD } from "../../theme";

bootLiveKit();

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
const VIEWER_ROOM_OPTIONS = { adaptiveStream: false, dynacast: true };
const VIEWER_CONNECT_OPTIONS = { autoSubscribe: true };

export function LiveKitRemoteVideo({
  roomName,
  identity,
  displayName,
  battleActive = false,
  hostFighter = null,
  guestFighter = null,
  liveEnded = false,
  overlayFx,
}: {
  roomName: string;
  identity: string;
  displayName: string;
  battleActive?: boolean;
  hostFighter?: BattleSplitFighter | null;
  guestFighter?: BattleSplitFighter | null;
  liveEnded?: boolean;
  overlayFx?: LiveFxPayload;
}) {
  const { t } = useTranslation();
  const [session, setSession] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomKey, setRoomKey] = useState(0);
  const [phase, setPhase] = useState<"ok" | "reconnecting" | "failed">("ok");
  const retriesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        bootLiveKit();
        await startViewerPlaybackAudioSession();
        const s = await fetchLiveKitSession(roomName, identity, displayName, "viewer");
        if (!cancelled) {
          setSession(s);
          setError(null);
          setPhase("ok");
        }
      } catch (e) {
        if (!cancelled) {
          setPhase("failed");
          setError(e instanceof Error ? e.message : t("live.viewerConnectFailed"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayName, identity, roomName, roomKey, t]);

  useEffect(() => {
    return () => {
      void stopViewerPlaybackAudioSession();
    };
  }, []);

  const retry = useCallback(() => {
    retriesRef.current += 1;
    setError(null);
    setPhase("reconnecting");
    setSession(null);
    setRoomKey((k) => k + 1);
  }, []);

  const handleDisconnected = useCallback(() => {
    if (liveEnded) return;
    if (retriesRef.current >= 4) {
      setPhase("failed");
      setError(t("live.viewerConnectFailed"));
      return;
    }
    setPhase("reconnecting");
    setTimeout(retry, 900);
  }, [liveEnded, retry, t]);

  const handleRoomError = useCallback(
    (e: Error) => {
      if (liveEnded) return;
      if (e.name === "ConnectionError") {
        setPhase("reconnecting");
        return;
      }
      setPhase("failed");
      setError(e.message || t("live.viewerConnectFailed"));
    },
    [liveEnded, t],
  );

  if (liveEnded) {
    return (
      <View style={[FILL, styles.center]}>
        <Text style={styles.wait}>{t("live.endedTitle")}</Text>
      </View>
    );
  }
  if (phase === "failed" || error) {
    return (
      <View style={[FILL, styles.center]}>
        <Text style={styles.err}>{error || t("live.viewerConnectFailed")}</Text>
        <Press onPress={retry} style={styles.retry}>
          <Text style={styles.retryTxt}>{t("common.retry")}</Text>
        </Press>
      </View>
    );
  }
  if (!session) {
    return (
      <View style={[FILL, styles.center]}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.wait}>
          {phase === "reconnecting" ? t("live.viewerReconnecting") : t("live.viewerConnecting")}
        </Text>
      </View>
    );
  }

  return (
    <View style={FILL}>
      <LiveKitRoom
        key={roomKey}
        serverUrl={session.url}
        token={session.token}
        connect
        audio={VIEWER_PUBLISH_MIC}
        video={false}
        // Always off: adaptiveStream in the 118×210 mini player drops frames,
        // so iOS/Android PiP would open on a black surface.
        options={VIEWER_ROOM_OPTIONS}
        connectOptions={VIEWER_CONNECT_OPTIONS}
        onDisconnected={handleDisconnected}
        onError={handleRoomError}
      >
        <RemoteCamera
          battleActive={battleActive}
          hostFighter={hostFighter}
          guestFighter={guestFighter}
          reconnecting={phase === "reconnecting"}
          overlayFx={overlayFx}
        />
      </LiveKitRoom>
    </View>
  );
}

function RemoteCamera({
  battleActive,
  hostFighter,
  guestFighter,
  reconnecting,
  overlayFx,
}: {
  battleActive: boolean;
  hostFighter?: BattleSplitFighter | null;
  guestFighter?: BattleSplitFighter | null;
  reconnecting: boolean;
  overlayFx?: LiveFxPayload;
}) {
  const { t } = useTranslation();
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Camera]);
  const [fx, setFx] = useState<LiveFxPayload>(EMPTY_LIVE_FX);
  const host = tracks.find(
    (t) =>
      isTrackReference(t) &&
      !t.participant.isLocal &&
      !isBattleGuestIdentity(t.participant.identity),
  );
  const guest = tracks.find(
    (t) =>
      isTrackReference(t) &&
      !t.participant.isLocal &&
      isBattleGuestIdentity(t.participant.identity),
  );
  const hadHostRef = useRef(false);
  if (host && isTrackReference(host)) hadHostRef.current = true;

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== LIVE_FX_TOPIC) return;
      const next = decodeLiveFx(payload);
      if (next) setFx(next);
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  const waiting = (
    <View style={[FILL, styles.center]}>
      <ActivityIndicator color="#fff" />
      <Text style={styles.wait}>
        {reconnecting
          ? t("live.viewerReconnecting")
          : hadHostRef.current
            ? t("live.hostBackSoon")
            : t("live.waitingForSeller")}
      </Text>
    </View>
  );

  const hostVideo =
    host && isTrackReference(host) ? (
      <View style={FILL}>
        <VideoTrack
          trackRef={host}
          style={FILL}
          objectFit="cover"
          zOrder={0}
          iosPIP={
            Platform.OS === "ios"
              ? {
                  enabled: true,
                  startAutomatically: true,
                  preferredSize: { width: 9, height: 16 },
                }
              : undefined
          }
        />
        <LiveFxOverlay fx={liveFxHasVisual(overlayFx ?? EMPTY_LIVE_FX) ? (overlayFx ?? fx) : fx} />
      </View>
    ) : (
      waiting
    );

  const guestVideo =
    guest && isTrackReference(guest) ? (
      <VideoTrack trackRef={guest} style={FILL} objectFit="cover" />
    ) : null;

  if (!battleActive) {
    return hostVideo;
  }

  return (
    <BattleSplitStage
      active
      hostVideo={hostVideo}
      hostFighter={hostFighter}
      guestVideo={guestVideo}
      guestFighter={guestFighter}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    gap: 10,
  },
  err: {
    color: "#fecaca",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
    fontWeight: "700",
  },
  wait: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 10 },
  retry: {
    marginTop: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  retryTxt: { color: "#0B1436", fontWeight: "800" },
});
