/** Viewer LiveKitRoom `audio` publishes the mic — keep it off. Remote audio is auto-subscribed. */
export const VIEWER_PUBLISH_MIC = false;

/** Android waits this long after JS expands the video before snapshotting PiP. */
export const ANDROID_PIP_PREPARE_MS = 180;

export const VIEWER_APPLE_PLAYBACK = {
  audioCategory: "playback",
  audioCategoryOptions: ["mixWithOthers"],
  audioMode: "moviePlayback",
} as const;

export const VIEWER_ANDROID_AUDIO_PRESET = "media" as const;

/** Mini player or system PiP: keep full-res frames so the bubble is not black. */
export function viewerKeepsFullVideoQuality(
  minimized: boolean,
  systemPip: boolean,
): boolean {
  return minimized || systemPip;
}

export function viewerAdaptiveStreamEnabled(keepFullQuality: boolean): boolean {
  return !keepFullQuality;
}

export function liveSystemPipOn(active: boolean, preparing: boolean): boolean {
  return active || preparing;
}
