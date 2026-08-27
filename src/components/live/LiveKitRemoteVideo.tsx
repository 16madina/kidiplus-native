import { bootLiveKit } from "../../lib/livekit-boot";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AudioSession, LiveKitRoom, VideoTrack, isTrackReference, useTracks } from "@livekit/react-native";
import { Track } from "livekit-client";
import { fetchLiveKitSession } from "../../lib/livekit";

bootLiveKit();

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function LiveKitRemoteVideo({
  roomName,
  identity,
  displayName,
}: {
  roomName: string;
  identity: string;
  displayName: string;
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
        await AudioSession.startAudioSession();
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
      void AudioSession.stopAudioSession();
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
        audio
        video={false}
        options={{ adaptiveStream: { pixelDensity: "screen" }, dynacast: true }}
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
        <RemoteCamera />
      </LiveKitRoom>
    </View>
  );
}

function RemoteCamera() {
  const tracks = useTracks([Track.Source.Camera]);
  const remote = tracks.find((t) => isTrackReference(t) && !t.participant.isLocal);
  if (!remote || !isTrackReference(remote)) {
    return (
      <View style={[FILL, styles.center]}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.wait}>En attente de la caméra du vendeur…</Text>
      </View>
    );
  }
  return <VideoTrack trackRef={remote} style={FILL} objectFit="cover" />;
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
