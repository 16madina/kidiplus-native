import { bootLiveKit } from "../lib/livekit-boot";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { ActivityIndicator, Alert, AppState, LogBox, StyleSheet, Text, View } from "react-native";
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
import { HostComposedPreview } from "../components/broadcast/HostComposedPreview";
import { HostLiveFxSync } from "../components/broadcast/HostLiveFxSync";
import { HostPublishedPipeline } from "../components/broadcast/HostPublishedPipeline";
import { HostStudioHud } from "../components/broadcast/HostStudioHud";
import { SnapCameraPreview } from "../components/broadcast/SnapCameraPreview";
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
import {
  flipBridgeCamera,
  setBridgePublishEnabled,
  setNativeLensApplyAllowed,
  stopBridgePreview,
} from "../lib/filters/camera-kit-bridge";
import { useFilter } from "../lib/filters/filter-context";
import { stopFilteredPublish, tryStartFilteredPublish } from "../lib/filters/host-pipeline";
import { useLiveEffects } from "../lib/filters/live-effects-context";
import { stopNativeLiveEffects } from "../lib/filters/live-effects-native-bridge";
import {
  delayMs,
  registerHostPickerPause,
  restartHostCamera,
  runHostCameraExclusive,
  setHostCameraEnabled,
} from "../lib/host-camera";
import { fetchLiveKitSession } from "../lib/livekit";
import { startLiveReplay, stopLiveReplay } from "../lib/live-replay";
import { endLiveInDb, touchLiveHostInDb } from "../lib/lives";
import { notifyHostLiveEnded } from "../lib/host-open-live";
import { supabase } from "../lib/supabase";
import { GOLD } from "../theme";
import type { CameraType } from "expo-camera";

bootLiveKit();
LogBox.ignoreLogs(["error reading from signal stream"]);

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
const HOST_ROOM_OPTIONS = { adaptiveStream: { pixelDensity: "screen" as const }, dynacast: true };
const HOST_CONNECT_OPTIONS = { autoSubscribe: true };
const ignoreDisconnect = () => undefined;

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
  const { activeLens } = useFilter();
  const { hasEffects } = useLiveEffects();
  const endingRef = useRef(false);
  const lensRef = useRef(activeLens);
  const effectsRef = useRef(hasEffects);
  lensRef.current = activeLens;
  effectsRef.current = hasEffects;
  const [session, setSession] = useState<{ url: string; token: string } | null>(null);
  const [kitPublishing, setKitPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<LiveSummaryStats | null>(null);
  const handleRoomError = useCallback((e: Error) => {
    if (endingRef.current) return;
    if (e.name === "ConnectionError") {
      setError("Connexion live coupée. Vérifie le Wi-Fi et relance.");
      return;
    }
    setError(e.message);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        bootLiveKit();
        await AudioSession.startAudioSession();
        const s = await fetchLiveKitSession(roomName, identity, displayName, "host");
        if (cancelled) return;
        const kit = await tryStartFilteredPublish({
          url: s.url,
          token: s.token,
          facing: facing === "back" ? "environment" : "user",
          lens: lensRef.current,
          hasEffects: effectsRef.current,
        });
        if (cancelled) {
          await stopFilteredPublish();
          return;
        }
        if (kit.path === "kit_failed") {
          setError(
            "Le filtre n’a pas pu partir dans la vidéo. Sur Mac : git pull origin main && npm run rebuild:ios, puis ouvre KiDi+ (pas Expo Go).",
          );
          return;
        }
        setKitPublishing(kit.path === "kit_publish");
        setSession(s);
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
      void stopFilteredPublish();
    };
  }, [roomName, identity, displayName, facing]);

  useEffect(() => {
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  useEffect(() => {
    if (!summary) return;
    void AudioSession.stopAudioSession();
    void stopFilteredPublish();
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

  if (kitPublishing) {
    return (
      <HostKitStage
        liveId={liveId}
        identity={identity}
        displayName={displayName}
        facing={facing}
        session={session}
        endingRef={endingRef}
        onEnded={setSummary}
      />
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
        options={HOST_ROOM_OPTIONS}
        connectOptions={HOST_CONNECT_OPTIONS}
        onDisconnected={ignoreDisconnect}
        onError={handleRoomError}
      >
        <PublishLocalMedia facing={facing} />
        <HostLiveKitStage
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

function useHostLiveExtras(liveId: string) {
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

  return {
    battle,
    battleActive,
    myLive,
    opponentLive,
    startedAtMsRef,
    peakRef,
    onBattleAccepted,
  };
}

function HostChrome({
  liveId,
  identity,
  displayName,
  facing,
  hostVideo,
  guestVideo,
  hostFighter,
  guestFighter,
  guestStatus,
  battle,
  battleActive,
  viewerFallback,
  micOn,
  camOn,
  busy,
  fxSync,
  onToggleMic,
  onToggleCam,
  onFlip,
  onEnd,
  onBattleAccepted,
}: {
  liveId: string;
  identity: string;
  displayName: string;
  facing: CameraType;
  hostVideo: ReactNode;
  guestVideo: ReactNode;
  hostFighter: { displayName: string; avatarUrl: string | null };
  guestFighter: { displayName: string; avatarUrl: string | null } | null;
  guestStatus?: string;
  battle?: HydratedBattle | null;
  battleActive: boolean;
  viewerFallback: number;
  micOn: boolean;
  camOn: boolean;
  busy: boolean;
  fxSync?: ReactNode;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onFlip: () => void;
  onEnd: () => void;
  onBattleAccepted?: () => void;
}) {
  const { t } = useTranslation();
  const { closeOverlay } = useNav();
  return (
    <View style={styles.root}>
      <BattleSplitStage
        active={battleActive}
        hostVideo={hostVideo}
        hostFighter={hostFighter}
        guestVideo={guestVideo}
        guestFighter={guestFighter}
        guestStatus={guestStatus}
      />
      {fxSync}
      <HostStudioHud
        liveId={liveId}
        identity={identity}
        displayName={displayName}
        viewerFallback={viewerFallback}
        micOn={micOn}
        camOn={camOn}
        onToggleMic={onToggleMic}
        onToggleCam={onToggleCam}
        onFlip={onFlip}
        onEnd={onEnd}
        onMinimize={closeOverlay}
        onBattleAccepted={onBattleAccepted}
        cameraFacing={facing}
        battle={battle}
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

/**
 * Android Camera Kit publishes filtered frames with its own LiveKit room
 * (same as kidiplus.com). Do not also connect the JS room — same token
 * would kick the native publisher and viewers would lose the video.
 */
function HostKitStage({
  liveId,
  identity,
  displayName,
  facing: initialFacing,
  session,
  endingRef,
  onEnded,
}: {
  liveId: string;
  identity: string;
  displayName: string;
  facing: CameraType;
  session: { url: string; token: string };
  endingRef: MutableRefObject<boolean>;
  onEnded: (stats: LiveSummaryStats) => void;
}) {
  const { t } = useTranslation();
  const extras = useHostLiveExtras(liveId);
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<CameraType>(initialFacing);
  const [flipBusy, setFlipBusy] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const camBusyRef = useRef(false);

  useEffect(() => {
    setNativeLensApplyAllowed(true);
    void stopNativeLiveEffects();
    registerHostPickerPause(async (work) => work());
    return () => {
      registerHostPickerPause(null);
    };
  }, []);
  const liveEffects = useLiveEffects();

  const actuallyFinish = async () => {
    if (busy || endingRef.current) return;
    endingRef.current = true;
    setBusy(true);
    const durationSec = Math.max(0, Math.floor((Date.now() - extras.startedAtMsRef.current) / 1000));
    const peakViewers = extras.peakRef.current;

    const ended = await endLiveInDb(liveId);
    if (!ended.ok) {
      endingRef.current = false;
      setBusy(false);
      Alert.alert(t("live.endFailed"));
      return;
    }
    await stopLiveReplay(liveId).catch(() => undefined);
    notifyHostLiveEnded(liveId);
    await stopFilteredPublish();
    void stopBridgePreview();
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
    if (flipBusy || !camOn) return;
    setFlipBusy(true);
    try {
      const result = await flipBridgeCamera();
      if (result?.facing === "environment" || result?.facing === "user") {
        setFacing(result.facing === "environment" ? "back" : "front");
      } else {
        setFacing((prev) => (prev === "back" ? "front" : "back"));
      }
    } finally {
      setFlipBusy(false);
    }
  };

  return (
    <HostChrome
      liveId={liveId}
      identity={identity}
      displayName={displayName}
      facing={facing}
      hostVideo={
        camOn ? (
          <View style={FILL}>
            <SnapCameraPreview facing={facing} persistPreviewOnUnmount />
            <HostComposedPreview />
          </View>
        ) : (
          <View style={[FILL, styles.center]}>
            <Text style={styles.wait}>Caméra coupée</Text>
          </View>
        )
      }
      guestVideo={null}
      hostFighter={
        extras.myLive
          ? { displayName: extras.myLive.display_name, avatarUrl: extras.myLive.avatar_url }
          : { displayName, avatarUrl: null }
      }
      guestFighter={
        extras.opponentLive
          ? {
              displayName: extras.opponentLive.display_name,
              avatarUrl: extras.opponentLive.avatar_url,
            }
          : null
      }
      battle={extras.battle}
      battleActive={extras.battleActive}
      viewerFallback={0}
      micOn={micOn}
      camOn={camOn}
      busy={busy}
      onToggleMic={() => setMicOn((v) => !v)}
      onToggleCam={() => {
        if (camBusyRef.current) return;
        const next = !camOn;
        setCamOn(next);
        camBusyRef.current = true;
        void setBridgePublishEnabled(
          next
            ? { enabled: true, roomUrl: session.url, token: session.token }
            : { enabled: false },
        )
          .catch(() => setCamOn(!next))
          .finally(() => {
            camBusyRef.current = false;
          });
      }}
      onFlip={() => void flip()}
      onEnd={finish}
      onBattleAccepted={extras.onBattleAccepted}
      fxSync={
        <>
          <HostPublishedPipeline facing={facing} />
          <HostLiveFxSync
            liveId={liveId}
            userId={identity}
            bakedBackground={liveEffects.backgroundMode !== "none"}
          />
        </>
      }
    />
  );
}

function HostLiveFxSyncInRoom({ liveId, userId }: { liveId: string; userId: string }) {
  const room = useRoomContext();
  return (
    <HostLiveFxSync
      liveId={liveId}
      userId={userId}
      liveKit={{
        publishData: (data, options) =>
          room.localParticipant.publishData(data as Uint8Array<ArrayBuffer>, options),
        on: (event, listener) => {
          room.on(event as "participantConnected", listener);
        },
        off: (event, listener) => {
          room.off(event as "participantConnected", listener);
        },
      }}
    />
  );
}

function HostLiveKitStage({
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
  const extras = useHostLiveExtras(liveId);
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<CameraType>(initialFacing);
  const [flipBusy, setFlipBusy] = useState(false);
  const facingRef = useRef(initialFacing);
  const participantRef = useRef(localParticipant);
  const camWantedRef = useRef(true);
  const pickingRef = useRef(false);
  facingRef.current = facing;
  participantRef.current = localParticipant;

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
    enabled: extras.battleActive,
    userId: identity,
    displayName,
    remoteRoomName: extras.opponentLive?.room_name ?? null,
    getSourceTrack: getBattleSourceTrack,
    getSourceAudioTrack: getBattleSourceAudioTrack,
  });

  useEffect(() => {
    const n = Math.max(0, people.length - 1);
    if (n > extras.peakRef.current) extras.peakRef.current = n;
  }, [people.length, extras.peakRef]);

  useEffect(() => {
    setNativeLensApplyAllowed(false);
    void stopBridgePreview();
    void stopNativeLiveEffects();
    registerHostPickerPause(async (work) => {
      pickingRef.current = true;
      try {
        return await runHostCameraExclusive(async () => {
          await setHostCameraEnabled(participantRef.current, false, facingRef.current);
          await delayMs(220);
          try {
            return await work();
          } finally {
            await delayMs(420);
            if (camWantedRef.current) {
              await setHostCameraEnabled(participantRef.current, true, facingRef.current);
            }
          }
        });
      } finally {
        pickingRef.current = false;
      }
    });
    return () => {
      registerHostPickerPause(null);
      setNativeLensApplyAllowed(true);
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!camWantedRef.current || pickingRef.current) return;
      void runHostCameraExclusive(() =>
        setHostCameraEnabled(participantRef.current, true, facingRef.current),
      );
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!camWantedRef.current || pickingRef.current || isCameraEnabled) return;
    const id = setTimeout(() => {
      if (!camWantedRef.current || pickingRef.current || endingRef.current) return;
      void runHostCameraExclusive(() =>
        setHostCameraEnabled(participantRef.current, true, facingRef.current),
      );
    }, 1400);
    return () => clearTimeout(id);
  }, [isCameraEnabled, endingRef]);

  const actuallyFinish = async () => {
    if (busy || endingRef.current) return;
    endingRef.current = true;
    setBusy(true);
    const durationSec = Math.max(0, Math.floor((Date.now() - extras.startedAtMsRef.current) / 1000));
    const peakViewers = Math.max(extras.peakRef.current, Math.max(0, people.length - 1));

    const ended = await endLiveInDb(liveId);
    if (!ended.ok) {
      endingRef.current = false;
      setBusy(false);
      Alert.alert(t("live.endFailed"));
      return;
    }
    await stopLiveReplay(liveId).catch(() => undefined);
    notifyHostLiveEnded(liveId);

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
    if (flipBusy || !camWantedRef.current || pickingRef.current) return;
    setFlipBusy(true);
    const next: CameraType = facing === "back" ? "front" : "back";
    try {
      await runHostCameraExclusive(() => restartHostCamera(localParticipant, next));
      setFacing(next);
    } catch {
      /* keep current facing */
    } finally {
      setFlipBusy(false);
    }
  };

  const toggleCam = () => {
    if (pickingRef.current) return;
    camWantedRef.current = !camWantedRef.current;
    void runHostCameraExclusive(() =>
      setHostCameraEnabled(localParticipant, camWantedRef.current, facing),
    );
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
    <HostChrome
      liveId={liveId}
      identity={identity}
      displayName={displayName}
      facing={facing}
      hostVideo={hostVideo}
      guestVideo={guestVideo}
      hostFighter={
        extras.myLive
          ? { displayName: extras.myLive.display_name, avatarUrl: extras.myLive.avatar_url }
          : { displayName, avatarUrl: null }
      }
      guestFighter={
        extras.opponentLive
          ? {
              displayName: extras.opponentLive.display_name,
              avatarUrl: extras.opponentLive.avatar_url,
            }
          : null
      }
      guestStatus={remoteBattleStatus}
      battle={extras.battle}
      battleActive={extras.battleActive}
      viewerFallback={Math.max(0, people.length - 1)}
      micOn={isMicrophoneEnabled}
      camOn={isCameraEnabled}
      busy={busy}
      fxSync={<HostLiveFxSyncInRoom liveId={liveId} userId={identity} />}
      onToggleMic={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      onToggleCam={toggleCam}
      onFlip={() => void flip()}
      onEnd={finish}
      onBattleAccepted={extras.onBattleAccepted}
    />
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
