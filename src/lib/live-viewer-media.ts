/** Viewer LiveKitRoom `audio` publishes the mic — keep it off. Remote audio is auto-subscribed. */
export const VIEWER_PUBLISH_MIC = false;

/** Android waits this long after JS expands the video before snapshotting PiP. */
export const ANDROID_PIP_PREPARE_MS = 180;

export const VIEWER_APPLE_PLAYBACK = {
  audioCategory: "playback",
  /** Empty: `mixWithOthers` lets iOS mute us in background / system PiP. */
  audioCategoryOptions: [] as const,
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

/** 9:16 — matches the portrait live, used as AVKit's suggested PiP ratio. */
export const HOST_IOS_PIP_SIZE = { width: 9, height: 16 } as const;

/**
 * iOS LiveKit `VideoTrack.iosPIP`.
 *
 * Must stay **off** for the in-app preview and the 118×210 mini: `enabled: true`
 * attaches AVPictureInPictureController to the same view, which draws black
 * once that view is shrunk/moved. Only turn it on when we are entering
 * system PiP (`systemPip`, i.e. AppState inactive/background).
 */
export function hostIosPipConfig(systemPip: boolean): {
  enabled: boolean;
  startAutomatically: boolean;
  preferredSize: { width: number; height: number };
} {
  return {
    enabled: systemPip,
    startAutomatically: systemPip,
    preferredSize: HOST_IOS_PIP_SIZE,
  };
}
