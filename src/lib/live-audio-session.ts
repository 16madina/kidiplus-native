import { Platform } from "react-native";
import { AndroidAudioTypePresets, AudioSession } from "@livekit/react-native";
import {
  AudioDeviceModule,
  AudioEngineAvailability,
} from "@livekit/react-native-webrtc";
import { VIEWER_APPLE_PLAYBACK } from "./live-viewer-media";

let viewerOwners = 0;
let viewerAudioStarted = false;
let viewerAudioQueue: Promise<void> = Promise.resolve();

function logViewerAudio(message: string): void {
  console.log(`[KiDi+ audio] ${message}`);
}

function enqueueViewerAudio(work: () => Promise<void>): Promise<void> {
  const next = viewerAudioQueue.then(work, work);
  viewerAudioQueue = next.catch(() => undefined);
  return next;
}

async function configureViewerPlaybackAudioSession(): Promise<void> {
  await AudioSession.configureAudio({
    android: {
      preferredOutputList: ["speaker", "bluetooth", "headset", "earpiece"],
      audioTypeOptions: AndroidAudioTypePresets.media,
    },
    ios: { defaultOutput: "speaker" },
  });
  if (Platform.OS === "ios") {
    await AudioSession.setAppleAudioConfiguration({
      audioCategory: VIEWER_APPLE_PLAYBACK.audioCategory,
      audioCategoryOptions: [...VIEWER_APPLE_PLAYBACK.audioCategoryOptions],
      audioMode: VIEWER_APPLE_PLAYBACK.audioMode,
    });
  }
}

/**
 * Viewer playback (not a call): speaker + media focus so sound continues
 * in Android PiP and iOS background / system PiP.
 */
export async function startViewerPlaybackAudioSession(): Promise<void> {
  viewerOwners += 1;
  logViewerAudio(`start requested owners=${viewerOwners} started=${viewerAudioStarted}`);
  if (Platform.OS === "ios") {
    // registerGlobals() installs LiveKit's native AudioDeviceModule policy.
    // Arm WebRTC output before the room subscribes to its first remote audio
    // track. LiveKit still owns the later AVAudioSession activation; starting
    // that session manually here would recreate the silent-first-entry race.
    await AudioDeviceModule.setEngineAvailability(AudioEngineAvailability.default);
    await AudioSession.setDefaultRemoteAudioTrackVolume(1);
    logViewerAudio("iOS playout armed; activation delegated to LiveKit automatic audio management");
    return;
  }
  return enqueueViewerAudio(async () => {
    if (viewerAudioStarted || viewerOwners === 0) return;
    // This is a default for tracks created afterwards, so set it before the
    // room can subscribe instead of after the first audio track already exists.
    await AudioSession.setDefaultRemoteAudioTrackVolume(1);
    await configureViewerPlaybackAudioSession();
    await AudioSession.startAudioSession();
    viewerAudioStarted = true;
    logViewerAudio("started remote volume=1");
  });
}

export async function resumeViewerPlaybackAudioSession(): Promise<void> {
  logViewerAudio(`resume requested owners=${viewerOwners} started=${viewerAudioStarted}`);
  if (Platform.OS === "ios") {
    logViewerAudio("iOS resume delegated to LiveKit automatic audio management");
    return;
  }
  return enqueueViewerAudio(async () => {
    if (viewerOwners === 0) return;
    await configureViewerPlaybackAudioSession();
    await AudioSession.startAudioSession();
    await AudioSession.setDefaultRemoteAudioTrackVolume(1);
    viewerAudioStarted = true;
    logViewerAudio("resumed remote volume=1");
  });
}

/**
 * The native iOS PiP room has its own WebRTC audio engine. When that engine
 * stops on foreground, the RN engine is still logically enabled and therefore
 * does not receive a normal start transition. Cycle only its output side so it
 * binds back to AVAudioSession without reconnecting the visible LiveKit room.
 */
export async function restartViewerPlayoutAfterBackground(): Promise<void> {
  if (Platform.OS !== "ios") {
    await resumeViewerPlaybackAudioSession();
    return;
  }
  logViewerAudio(`foreground playout restart requested owners=${viewerOwners}`);
  return enqueueViewerAudio(async () => {
    if (viewerOwners === 0) return;
    // A direct stopPlayout/startPlayout cycle returns -1 while the LiveKit
    // remote track still owns playout. Availability is the supported reset:
    // disabling stops the engine, then `.default` restarts all pending output
    // requests that remain owned by the subscribed track.
    await AudioDeviceModule.setEngineAvailability(AudioEngineAvailability.none);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await AudioDeviceModule.setEngineAvailability(AudioEngineAvailability.default);
    await AudioSession.setDefaultRemoteAudioTrackVolume(1);
    logViewerAudio("foreground playout restarted");
  });
}

export async function stopViewerPlaybackAudioSession(): Promise<void> {
  viewerOwners = Math.max(0, viewerOwners - 1);
  logViewerAudio(`stop requested owners=${viewerOwners} started=${viewerAudioStarted}`);
  if (Platform.OS === "ios") {
    // The same automatic policy releases its own activation when the final
    // remote audio track/room disconnects. A manual stop here would steal that
    // activation and reintroduce the silent-next-entry bug.
    return;
  }
  return enqueueViewerAudio(async () => {
    if (viewerOwners !== 0 || !viewerAudioStarted) return;
    await AudioSession.stopAudioSession();
    viewerAudioStarted = false;
    logViewerAudio("stopped");
  });
}
