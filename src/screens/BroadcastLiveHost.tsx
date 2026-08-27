import { bootLiveKit } from "../lib/livekit-boot";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { ActivityIndicator, Alert, LogBox, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/react-native";
import { LocalAudioTrack, LocalVideoTrack, Track } from "livekit-client";
import { Press } from "../components/Press";
import { BattleSplitStage } from "../components/battle/BattleSplitStage";
import { BroadcastSummary } from "../components/broadcast/BroadcastSummary";
import { HostStudioHud } from "../components/broadcast/HostStudioHud";
import { useNav } from "../context/navigation";
import { useBattleGuestPublish } from "../hooks/useBattleGuestPublish";
import {
  battleHeartbeat,
  fetchBattleForLive,
  isBattleGuestIdentity,
  isBattleLiveActive,
  useBattleForLive,
  type HydratedBattle,
} from "../lib/battles";
import { fetchLiveKitSession } from "../lib/livekit";
import { startLiveReplay, stopLiveReplay } from "../lib/live-replay";
import { endLiveInDb, touchLiveHostInDb } from "../lib/lives";
import { supabase } from "../lib/supabase";
import { GOLD } from "../theme";
import type { CameraType } from "expo-camera";

bootLiveKit();
LogBox.ignoreLogs(["error reading from signal stream"]);

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

type LiveSummaryStats = { durationSec: number; peakViewers: number };

export function BroadcastLiveHost({
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
  const endingRef = useRef(false);
  const [session, setSession] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<LiveSummaryStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        bootLiveKit();
        await AudioSession.startAudioSession();
        const s = await fetchLiveKitSession(roomName, identity, displayName, "host");
        if (!cancelled) setSession(s);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Connexion LiveKit impossible";
        if (msg.includes("build natif") || msg.includes("Expo Go")) {
          setError(
            "LiveKit a besoin d’un build natif (pas Expo Go). Sur Mac : npx expo run:ios --device",
          );
        } else {
          setError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomName, identity, displayName]);

  useEffect(() => {
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  useEffect(() => {
    if (!summary) return;
    void AudioSession.stopAudioSession();
  }, [summary]);

  if (summary) {
    return (
      <BroadcastSummary
        liveId={liveId}
        title={title}
        durationSec={summary.durationSec}
        peakViewers={summary.peakViewers}
        onDone={closeOverlay}
      />
    );
  }

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
        audio={false}
        video={false}
        options={{ adaptiveStream: { pixelDensity: "screen" }, dynacast: true }}
        connectOptions={{ autoSubscribe: true }}
        onDisconnected={() => undefined}
        onError={(e) => {
          if (endingRef.current) return;
          if (e.name === "ConnectionError") {
            setError("Connexion live coupée. Vérifie le Wi-Fi et relance.");
            return;
          }
          setError(e.message);
        }}
      >
        <PublishLocalMedia facing={facing} />
        <HostStage
          liveId={liveId}
          identity={identity}
          displayName={displayName}
          facing={facing}
          endingRef={endingRef}
          onEnded={setSummary}
        />
      </LiveKitRoom>
    </View>
  );
}

function PublishLocalMedia({ facing }: { facing: CameraType }) {
  const { localParticipant } = useLocalParticipant();
  useEffect(() => {
    const facingMode = facing === "back" ? "environment" : "user";
    void localParticipant.setMicrophoneEnabled(true).catch(() => undefined);
    void localParticipant.setCameraEnabled(true, { facingMode }).catch(() => undefined);
  }, [facing, localParticipant]);
  return null;
}

function HostStage({
  liveId,
  identity,
  displayName,
  facing: initialFacing,
  endingRef,
  onEnded,
}: {
  liveId: string;
  identity: string;
  displayName: string;
  facing: CameraType;
  endingRef: MutableRefObject<boolean>;
  onEnded: (stats: LiveSummaryStats) => void;
}) {
  const { t } = useTranslation();
  const room = useRoomContext();
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const cameraTrack = tracks.find((t) => isTrackReference(t) && t.participant.isLocal);
  const guestCamTrack = tracks.find(
    (t) =>
      isTrackReference(t) &&
      !t.participant.isLocal &&
      isBattleGuestIdentity(t.participant.identity),
  );
  const people = useParticipants();
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<CameraType>(initialFacing);
  const [flipBusy, setFlipBusy] = useState(false);
  const [battleOverride, setBattleOverride] = useState<HydratedBattle | null>(null);
  const startedAtMsRef = useRef(Date.now());
  const peakRef = useRef(0);
  const liveBattle = useBattleForLive(liveId);
  const battle = battleOverride ?? liveBattle;
  const battleActive = isBattleLiveActive(battle);

  const myLive = useMemo(
    () => battle?.lives.find((l) => l.live_id === liveId) ?? null,
    [battle, liveId],
  );
  const opponentLive = useMemo(
    () => battle?.lives.find((l) => l.live_id !== liveId) ?? null,
    [battle, liveId],
  );

  const getBattleSourceTrack = useCallback((): LocalVideoTrack | null => {
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track;
    return track instanceof LocalVideoTrack ? track : null;
  }, [localParticipant]);

  const getBattleSourceAudioTrack = useCallback((): LocalAudioTrack | null => {
    const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track;
    return track instanceof LocalAudioTrack ? track : null;
  }, [localParticipant]);

  const remoteBattleStatus = useBattleGuestPublish({
    enabled: battleActive,
    userId: identity,
    displayName,
    remoteRoomName: opponentLive?.room_name ?? null,
    getSourceTrack: getBattleSourceTrack,
    getSourceAudioTrack: getBattleSourceAudioTrack,
  });

  useEffect(() => {
    if (!battleActive || !battle?.session.id) return;
    const beat = () => void battleHeartbeat(battle.session.id);
    beat();
    const id = setInterval(beat, 10_000);
    return () => clearInterval(id);
  }, [battleActive, battle?.session.id]);

  useEffect(() => {
    if (liveBattle) setBattleOverride(null);
  }, [liveBattle]);

  const onBattleAccepted = useCallback(async () => {
    const next = await fetchBattleForLive(liveId);
    if (next) setBattleOverride(next);
  }, [liveId]);

  useEffect(() => {
    const tick = () => void touchLiveHostInDb(liveId);
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [liveId]);

  useEffect(() => {
    void startLiveReplay(liveId);
  }, [liveId]);

  useEffect(() => {
    let alive = true;
    void supabase
      .from("lives")
      .select("started_at")
      .eq("id", liveId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const ms = data?.started_at ? new Date(String(data.started_at)).getTime() : NaN;
        if (Number.isFinite(ms)) startedAtMsRef.current = ms;
      });
    return () => {
      alive = false;
    };
  }, [liveId]);

  useEffect(() => {
    const n = Math.max(0, people.length - 1);
    if (n > peakRef.current) peakRef.current = n;
  }, [people.length]);

  const actuallyFinish = async () => {
    if (busy || endingRef.current) return;
    endingRef.current = true;
    setBusy(true);
    const durationSec = Math.max(0, Math.floor((Date.now() - startedAtMsRef.current) / 1000));
    const peakViewers = Math.max(peakRef.current, Math.max(0, people.length - 1));

    const ended = await endLiveInDb(liveId);
    if (!ended.ok) {
      endingRef.current = false;
      setBusy(false);
      Alert.alert(t("live.endFailed"));
      return;
    }
    await stopLiveReplay(liveId).catch(() => undefined);

    try {
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setMicrophoneEnabled(false);
    } catch {
      /* already tearing down */
    }
    try {
      await room.disconnect();
    } catch {
      /* LiveKit logs ConnectionError / signal stream on a clean hangup */
    }

    onEnded({ durationSec, peakViewers });
  };

  const finish = () => {
    if (busy) return;
    Alert.alert(t("live.confirmEnd"), t("live.confirmEndBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("live.endLive"),
        style: "destructive",
        onPress: () => {
          void actuallyFinish();
        },
      },
    ]);
  };

  const flip = async () => {
    if (flipBusy || !isCameraEnabled) return;
    setFlipBusy(true);
    const next: CameraType = facing === "back" ? "front" : "back";
    const facingMode = next === "back" ? "environment" : "user";
    try {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (track && track instanceof LocalVideoTrack) {
        await track.restartTrack({ facingMode });
      } else {
        await localParticipant.setCameraEnabled(false);
        await localParticipant.setCameraEnabled(true, { facingMode });
      }
      setFacing(next);
    } catch {
      /* keep current facing */
    } finally {
      setFlipBusy(false);
    }
  };

  const hostVideo =
    cameraTrack && isTrackReference(cameraTrack) && isCameraEnabled ? (
      <VideoTrack
        trackRef={cameraTrack}
        style={FILL}
        objectFit="cover"
        mirror={facing !== "back"}
      />
    ) : (
      <View style={[FILL, styles.center]}>
        {isCameraEnabled ? (
          <>
            <ActivityIndicator color={GOLD} />
            <Text style={styles.wait}>Ouverture de la caméra…</Text>
          </>
        ) : (
          <Text style={styles.wait}>Caméra coupée</Text>
        )}
      </View>
    );

  const guestVideo =
    guestCamTrack && isTrackReference(guestCamTrack) ? (
      <VideoTrack trackRef={guestCamTrack} style={FILL} objectFit="cover" />
    ) : null;

  return (
    <View style={styles.root}>
      <BattleSplitStage
        active={battleActive}
        hostVideo={hostVideo}
        hostFighter={
          myLive
            ? { displayName: myLive.display_name, avatarUrl: myLive.avatar_url }
            : { displayName, avatarUrl: null }
        }
        guestVideo={guestVideo}
        guestFighter={
          opponentLive
            ? {
                displayName: opponentLive.display_name,
                avatarUrl: opponentLive.avatar_url,
              }
            : null
        }
        guestStatus={remoteBattleStatus}
      />
      <HostStudioHud
        liveId={liveId}
        identity={identity}
        displayName={displayName}
        viewerFallback={Math.max(0, people.length - 1)}
        micOn={isMicrophoneEnabled}
        camOn={isCameraEnabled}
        onToggleMic={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        onToggleCam={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        onFlip={() => void flip()}
        onEnd={finish}
        onBattleAccepted={onBattleAccepted}
      />
      {busy ? (
        <View style={[FILL, styles.ending]} pointerEvents="auto">
          <ActivityIndicator color={GOLD} />
          <Text style={styles.wait}>{t("live.endingLive")}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060a" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05060a",
    gap: 12,
    padding: 24,
  },
  wait: { color: "rgba(255,255,255,0.8)", fontWeight: "700" },
  err: { color: "#fff", textAlign: "center", fontWeight: "700", lineHeight: 22 },
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
  endTxt: { color: "#fff", fontWeight: "800" },
  ending: {
    backgroundColor: "rgba(5,6,10,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 80,
  },
});
