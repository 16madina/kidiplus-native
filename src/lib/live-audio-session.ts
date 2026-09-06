import { Platform } from "react-native";
import { AndroidAudioTypePresets, AudioSession } from "@livekit/react-native";
import { VIEWER_APPLE_PLAYBACK } from "./live-viewer-media";

let viewerOwners = 0;
let viewerAudioStarted = false;
let viewerAudioQueue: Promise<void> = Promise.resolve();

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
  return enqueueViewerAudio(async () => {
    if (viewerAudioStarted || viewerOwners === 0) return;
    await configureViewerPlaybackAudioSession();
    await AudioSession.startAudioSession();
    await AudioSession.setDefaultRemoteAudioTrackVolume(1);
    viewerAudioStarted = true;
  });
}

export async function resumeViewerPlaybackAudioSession(): Promise<void> {
  return enqueueViewerAudio(async () => {
    if (viewerOwners === 0) return;
    await configureViewerPlaybackAudioSession();
    await AudioSession.startAudioSession();
    await AudioSession.setDefaultRemoteAudioTrackVolume(1);
    viewerAudioStarted = true;
  });
}

export async function stopViewerPlaybackAudioSession(): Promise<void> {
  viewerOwners = Math.max(0, viewerOwners - 1);
  return enqueueViewerAudio(async () => {
    if (viewerOwners !== 0 || !viewerAudioStarted) return;
    await AudioSession.stopAudioSession();
    viewerAudioStarted = false;
  });
}
