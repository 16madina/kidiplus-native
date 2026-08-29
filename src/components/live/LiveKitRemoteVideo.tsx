import { bootLiveKit } from "../../lib/livekit-boot";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useTracks,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { BattleSplitStage, type BattleSplitFighter } from "../battle/BattleSplitStage";
import { isBattleGuestIdentity } from "../../lib/battles";
import {
  startViewerPlaybackAudioSession,
  stopViewerPlaybackAudioSession,
} from "../../lib/live-audio-session";
import { fetchLiveKitSession } from "../../lib/livekit";
import { VIEWER_PUBLISH_MIC } from "../../lib/live-viewer-media";

bootLiveKit();

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function LiveKitRemoteVideo({
  roomName,
  identity,
  displayName,
  battleActive = false,
  hostFighter = null,
  guestFighter = null,
}: {
  roomName: string;
  identity: string;
  displayName: string;
  battleActive?: boolean;
  hostFighter?: BattleSplitFighter | null;
  guestFighter?: BattleSplitFighter | null;
}) {
  const { t } = useTranslation();
  const [session, setSession] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        bootLiveKit();
        await startViewerPlaybackAudioSession();
        const s = await fetchLiveKitSession(roomName, identity, displayName, "viewer");
        if (!cancelled) setSession(s);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Flux indisponible");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayName, identity, roomName]);

  useEffect(() => {
    return () => {
      void stopViewerPlaybackAudioSession();
    };
  }, []);

  if (ended) {
    return (
      <View style={[FILL, styles.center]}>
        <Text style={styles.wait}>{t("live.endedTitle")}</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[FILL, styles.center]}>
        <Text style={styles.err}>{error}</Text>
      </View>
    );
  }
  if (!session) {
    return (
      <View style={[FILL, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <View style={FILL}>
      <LiveKitRoom
        serverUrl={session.url}
        token={session.token}
        connect
        audio={VIEWER_PUBLISH_MIC}
        video={false}
        options={{
          // Always off: adaptiveStream in the 118×210 mini player drops
          // frames, so iOS/Android PiP would open on a black surface.
          adaptiveStream: false,
          dynacast: true,
        }}
        connectOptions={{ autoSubscribe: true }}
        onDisconnected={() => {
          endedRef.current = true;
          setEnded(true);
        }}
        onError={(e) => {
          if (endedRef.current) return;
          if (e.name === "ConnectionError") return;
          setError(e.message);
        }}
      >
        <RemoteCamera
          battleActive={battleActive}
          hostFighter={hostFighter}
          guestFighter={guestFighter}
        />
      </LiveKitRoom>
    </View>
  );
}

function RemoteCamera({
  battleActive,
  hostFighter,
  guestFighter,
}: {
  battleActive: boolean;
  hostFighter?: BattleSplitFighter | null;
  guestFighter?: BattleSplitFighter | null;
}) {
  const { t } = useTranslation();
  const tracks = useTracks([Track.Source.Camera]);
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

  const waiting = (
    <View style={[FILL, styles.center]}>
      <ActivityIndicator color="#fff" />
      <Text style={styles.wait}>
        {hadHostRef.current
          ? t("live.hostBackSoon")
          : t("live.waitingForSeller")}
      </Text>
    </View>
  );

  const hostVideo =
    host && isTrackReference(host) ? (
      <VideoTrack
        trackRef={host}
        style={FILL}
        objectFit="cover"
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
});
