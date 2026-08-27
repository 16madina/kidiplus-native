import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic, MicOff, PhoneOff, Radio, Users } from "lucide-react-native";
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { Press } from "../components/Press";
import { Glass, GlassIconButton } from "../components/Glass";
import { useNav } from "../context/navigation";
import { bootLiveKit } from "../lib/livekit-boot";
import { fetchLiveKitSession } from "../lib/livekit";
import { endLiveInDb, touchLiveHostInDb } from "../lib/lives";
import { GOLD, LIVE_RED } from "../theme";
import type { CameraType } from "expo-camera";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function BroadcastLiveScreen({
  liveId,
  roomName,
  title,
  identity,
  displayName,
  facing,
}: {
  liveId: string;
  roomName: string;
  title: string;
  identity: string;
  displayName: string;
  facing: CameraType;
}) {
  const { closeOverlay } = useNav();
  const [session, setSession] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      bootLiveKit();
    } catch (e) {
      setError(
        "LiveKit a besoin d’un build natif (pas Expo Go). Sur Mac : npx expo run:ios --device",
      );
      return;
    }
    void AudioSession.startAudioSession().catch(() => undefined);
    void fetchLiveKitSession(roomName, identity, displayName, "host")
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Connexion LiveKit impossible");
      });
    return () => {
      cancelled = true;
      void AudioSession.stopAudioSession();
    };
  }, [roomName, identity, displayName]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{error}</Text>
        <Press onPress={closeOverlay} style={styles.tool}>
          <Text style={styles.endTxt}>Fermer</Text>
        </Press>
      </View>
    );
  }
  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GOLD} />
        <Text style={styles.wait}>Connexion au live…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LiveKitRoom
        serverUrl={session.url}
        token={session.token}
        connect
        audio
        video={{ facingMode: facing === "back" ? "environment" : "user" }}
        options={{ adaptiveStream: true, dynacast: true }}
        onError={(e) => setError(e.message)}
      >
        <HostStage liveId={liveId} title={title} facing={facing} />
      </LiveKitRoom>
    </View>
  );
}

function HostStage({
  liveId,
  title,
  facing,
}: {
  liveId: string;
  title: string;
  facing: CameraType;
}) {
  const insets = useSafeAreaInsets();
  const { closeOverlay } = useNav();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const cameraTrack = tracks.find((t) => isTrackReference(t) && t.participant.isLocal);
  const people = useParticipants();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => void touchLiveHostInDb(liveId);
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [liveId]);

  const finish = () => {
    Alert.alert("Terminer le live ?", "Les spectateurs seront déconnectés.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Terminer",
        style: "destructive",
        onPress: () => {
          if (busy) return;
          setBusy(true);
          void endLiveInDb(liveId).finally(() => {
            closeOverlay();
          });
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {cameraTrack && isTrackReference(cameraTrack) ? (
        <VideoTrack trackRef={cameraTrack} style={FILL} objectFit="cover" mirror={facing !== "back"} />
      ) : (
        <View style={[FILL, styles.center]}>
          <ActivityIndicator color={GOLD} />
          <Text style={styles.wait}>Ouverture de la caméra…</Text>
        </View>
      )}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Glass tone="dark" intensity={42} radius={999} padded={false}>
          <View style={styles.livePill}>
            <View style={styles.dot} />
            <Text style={styles.liveTxt}>EN DIRECT</Text>
            <Users size={12} color="#fff" />
            <Text style={styles.count}>{Math.max(0, people.length - 1)}</Text>
          </View>
        </Glass>
        <View style={{ flex: 1 }} />
        <GlassIconButton tone="dark" onPress={finish}>
          <PhoneOff size={18} color="#fff" />
        </GlassIconButton>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        <View style={styles.tools}>
          <Press
            onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            style={styles.tool}
          >
            {isMicrophoneEnabled ? <Mic size={18} color="#fff" /> : <MicOff size={18} color="#fff" />}
          </Press>
          <Press onPress={finish} style={[styles.tool, styles.end]}>
            <Radio size={16} color="#fff" />
            <Text style={styles.endTxt}>Terminer</Text>
          </Press>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#05060a", gap: 12, padding: 24 },
  wait: { color: "rgba(255,255,255,0.8)", fontWeight: "700" },
  err: { color: "#fff", textAlign: "center", fontWeight: "700", lineHeight: 22 },
  top: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 8, zIndex: 4 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE_RED },
  liveTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  count: { color: "#fff", fontWeight: "800", fontSize: 12 },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 0, gap: 12 },
  title: { color: "#fff", fontWeight: "800", fontSize: 18 },
  tools: { flexDirection: "row", alignItems: "center", gap: 10 },
  tool: {
    height: 48,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  end: { backgroundColor: LIVE_RED, flex: 1 },
  endTxt: { color: "#fff", fontWeight: "800" },
});
