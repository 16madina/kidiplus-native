import { Platform } from "react-native";
import { AndroidAudioTypePresets, AudioSession } from "@livekit/react-native";
import { VIEWER_APPLE_PLAYBACK } from "./live-viewer-media";

/**
 * Viewer playback (not a call): speaker + media focus so sound continues
 * in Android PiP and iOS background / system PiP.
 */
export async function startViewerPlaybackAudioSession(): Promise<void> {
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
  await AudioSession.startAudioSession();
  await AudioSession.setDefaultRemoteAudioTrackVolume(1);
}

export async function stopViewerPlaybackAudioSession(): Promise<void> {
  await AudioSession.stopAudioSession();
}
