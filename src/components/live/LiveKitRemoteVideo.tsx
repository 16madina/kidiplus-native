import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AudioSession, LiveKitRoom, VideoTrack, isTrackReference, useTracks } from "@livekit/react-native";
import { Track } from "livekit-client";
import { bootLiveKit } from "../../lib/livekit-boot";
import { fetchLiveKitSession } from "../../lib/livekit";

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
  const [session, setSession] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      bootLiveKit();
    } catch {
      setError(
        "Les lives vidéo demandent un build natif (pas Expo Go). Sur Mac : npx expo run:ios --device",
      );
      return;
    }
    void (async () => {
      try {
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
      void AudioSession.stopAudioSession();
    };
  }, [displayName, identity, roomName]);

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
        onError={(e) => setError(e.message)}
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
