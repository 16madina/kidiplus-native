import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { AndroidAudioTypePresets, AudioSession } from "@livekit/react-native";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  type LocalVideoTrack,
} from "livekit-client";
import {
  describeMediaTrack,
  pickBattleGuestPublishPath,
} from "../lib/battle-guest-publish";
import { battleGuestIdentity } from "../lib/battles";
import {
  canUseNativeBattleGuestPublish,
  setBridgeBattleGuestPublishEnabled,
} from "../lib/filters/camera-kit-bridge";
import { KidiCameraKit } from "../../modules/kidi-camera-kit/src";
import { fetchLiveKitSession } from "../lib/livekit";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function disconnectRoom(room: Room | null): Promise<void> {
  if (!room) return;
  try {
    await room.disconnect(true);
  } catch {
    /* ignore */
  }
}

async function unpublishSource(room: Room, source: Track.Source) {
  for (const pub of room.localParticipant.trackPublications.values()) {
    if (pub.source !== source || !pub.track) continue;
    try {
      await room.localParticipant.unpublishTrack(pub.track);
    } catch {
      /* ignore */
    }
  }
}

/**
 * iOS: the 2nd LiveKit connection (native or JS) has no audio unless the
 * native session is active. Host already started it; refresh it here and
 * never stop it from this hook — the host screen owns teardown.
 */
async function ensureBattleAudioSession(): Promise<void> {
  await AudioSession.configureAudio({
    android: {
      preferredOutputList: ["speaker", "bluetooth", "headset", "earpiece"],
      audioTypeOptions: AndroidAudioTypePresets.communication,
    },
    ios: { defaultOutput: "speaker" },
  });
  if (Platform.OS === "ios") {
    await AudioSession.setAppleAudioConfiguration({
      audioCategory: "playAndRecord",
      audioCategoryOptions: ["allowBluetooth", "defaultToSpeaker", "mixWithOthers"],
      audioMode: "videoChat",
    });
  }
  await AudioSession.startAudioSession();
}

async function stopNativeBattleGuest(): Promise<void> {
  try {
    await setBridgeBattleGuestPublishEnabled({ enabled: false });
  } catch {
    /* old binary / already stopped */
  }
}

/**
 * During a battle, publish camera + mic into the opponent's LiveKit room.
 * Native: Camera Kit frames → 2nd BufferCapturer (never MediaStreamTrack.clone).
 * Fallback: dedicated mic only — cloning the published camera track is dead on RN.
 */
export function useBattleGuestPublish(opts: {
  enabled: boolean;
  userId: string | null;
  displayName: string;
  remoteRoomName: string | null;
  nativeKitPublishing?: boolean;
  getSourceTrack?: () => LocalVideoTrack | null;
  getSourceAudioTrack?: () => LocalAudioTrack | null;
}) {
  const [remoteStatus, setRemoteStatus] = useState<
    "idle" | "connecting" | "live" | "reconnecting" | "error"
  >("idle");
  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const getSourceRef = useRef(opts.getSourceTrack);
  getSourceRef.current = opts.getSourceTrack;

  useEffect(() => {
    if (!opts.enabled || !opts.userId || !opts.remoteRoomName) {
      setRemoteStatus("idle");
      return;
    }
    let cancelled = false;
    const roomName = opts.remoteRoomName;
    const identity = battleGuestIdentity(opts.userId);
    const path = pickBattleGuestPublishPath({
      nativeMethod: canUseNativeBattleGuestPublish(),
      kitPublishing: opts.nativeKitPublishing,
    });

    async function runNative() {
      setRemoteStatus("connecting");
      while (!cancelled) {
        try {
          await ensureBattleAudioSession();
          if (cancelled) return;
          const { token, url } = await fetchLiveKitSession(
            roomName,
            identity,
            opts.displayName,
            "host",
          );
          if (cancelled) return;
          const result = await setBridgeBattleGuestPublishEnabled({
            enabled: true,
            roomUrl: url,
            token,
          });
          const status = await KidiCameraKit?.getStatus().catch(() => null);
          console.log("[battle] native guest publish", {
            enabled: result.enabled,
            room: roomName,
            identity,
            kit: status,
          });
          if (cancelled) {
            await stopNativeBattleGuest();
            return;
          }
          if (!result.enabled) {
            setRemoteStatus("error");
            await sleep(2000);
            continue;
          }
          setRemoteStatus("live");
          while (!cancelled) {
            await sleep(2000);
            const next = await KidiCameraKit?.getStatus().catch(() => null);
            if (cancelled) return;
            if (next && next.battleGuestPublishing === false) {
              console.warn("[battle] native guest publish dropped", next);
              setRemoteStatus("error");
              break;
            }
            setRemoteStatus("live");
          }
          await stopNativeBattleGuest();
        } catch (e) {
          console.warn("[battle] native guest publish failed", e);
          if (!cancelled) setRemoteStatus("error");
          await stopNativeBattleGuest();
          await sleep(2000);
        }
      }
    }

    async function runJsAudioOnly() {
      setRemoteStatus("connecting");
      const source = getSourceRef.current?.()?.mediaStreamTrack ?? null;
      console.warn("[battle] skipping video clone", describeMediaTrack(source));

      while (!cancelled) {
        try {
          await ensureBattleAudioSession();
          if (cancelled) return;
          const { token, url } = await fetchLiveKitSession(
            roomName,
            identity,
            opts.displayName,
            "host",
          );
          if (cancelled) return;
          const room = new Room({
            adaptiveStream: false,
            dynacast: true,
          });
          await room.connect(url, token, { autoSubscribe: false });
          console.log("[battle] js guest room", room.state);
          if (cancelled) {
            await disconnectRoom(room);
            return;
          }
          roomRef.current = room;
          room.on(RoomEvent.Reconnecting, () => {
            if (!cancelled) setRemoteStatus("reconnecting");
          });
          room.on(RoomEvent.Reconnected, () => {
            if (!cancelled) setRemoteStatus("live");
          });
          room.on(RoomEvent.Disconnected, () => {
            if (roomRef.current === room) roomRef.current = null;
            if (!cancelled) setRemoteStatus("error");
          });

          await unpublishSource(room, Track.Source.Microphone);
          const mic = await createLocalAudioTrack();
          audioTrackRef.current = mic;
          await room.localParticipant.publishTrack(mic, {
            name: "battle-guest-audio",
            source: Track.Source.Microphone,
          });
          console.log("[battle] js guest mic published (no camera clone)");
          if (cancelled) return;
          setRemoteStatus("live");

          while (!cancelled && roomRef.current === room) {
            if (room.state === "connected" && !cancelled) setRemoteStatus("live");
            await sleep(2000);
          }
          if (roomRef.current === room) roomRef.current = null;
          try {
            audioTrackRef.current?.stop();
          } catch {
            /* ignore */
          }
          audioTrackRef.current = null;
          void disconnectRoom(room);
          if (cancelled) return;
        } catch (e) {
          console.warn("[battle] js guest publish failed", e);
          if (!cancelled) setRemoteStatus("error");
          const room = roomRef.current;
          roomRef.current = null;
          try {
            audioTrackRef.current?.stop();
          } catch {
            /* ignore */
          }
          audioTrackRef.current = null;
          void disconnectRoom(room);
          await sleep(2000);
        }
      }
    }

    if (path === "native_kit") {
      void runNative();
    } else {
      void runJsAudioOnly();
    }

    return () => {
      cancelled = true;
      const room = roomRef.current;
      roomRef.current = null;
      try {
        audioTrackRef.current?.stop();
      } catch {
        /* ignore */
      }
      audioTrackRef.current = null;
      void disconnectRoom(room);
      if (path === "native_kit") void stopNativeBattleGuest();
    };
  }, [opts.enabled, opts.userId, opts.displayName, opts.remoteRoomName, opts.nativeKitPublishing]);

  return remoteStatus;
}
