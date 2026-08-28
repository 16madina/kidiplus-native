// Native frame-pump analogue.
// The web version (`frame-pump.web.ts`) drives canvas.captureStream() via rAF.
// On iOS/Android the native compositor owns the capture loop; this helper
// restarts it when the app returns to the foreground (same stall class as
// WebView rAF throttle / incoming call).

import { AppState, type NativeEventSubscription } from "react-native";

export type FramePump = { stop(): void };

export function startFramePump(opts: {
  onResume: () => void;
  onStall?: () => void;
}): FramePump {
  let stopped = false;
  const sub: NativeEventSubscription = AppState.addEventListener("change", (state) => {
    if (stopped) return;
    if (state === "active") opts.onResume();
  });
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      sub.remove();
    },
  };
}

export function rebindVideoSource(): void {
  /* native session rebinds internally */
}
