import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { KidiLivePip } from "kidi-live-pip";

/** Android system PiP (Home button). iOS uses LiveKit VideoTrack iosPIP. */
export function androidLivePipAvailable(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    return !!KidiLivePip?.isSupported();
  } catch {
    return false;
  }
}

export function setAndroidLivePipEnabled(enabled: boolean) {
  if (!androidLivePipAvailable()) return;
  try {
    KidiLivePip?.setEnabled(enabled);
  } catch {
    /* native module missing in this binary */
  }
}

export async function enterAndroidLivePip(): Promise<boolean> {
  if (!androidLivePipAvailable()) return false;
  try {
    return (await KidiLivePip?.enter()) ?? false;
  } catch {
    return false;
  }
}

export async function dismissAndroidLivePip(): Promise<void> {
  if (!androidLivePipAvailable()) return;
  try {
    await KidiLivePip?.dismiss();
  } catch {
    /* ignore */
  }
}

export function subscribeAndroidLivePip(cb: (active: boolean) => void): () => void {
  if (!androidLivePipAvailable() || !KidiLivePip?.addListener) return () => undefined;
  const sub = KidiLivePip.addListener("onPipModeChange", (e) => cb(!!e.active));
  return () => sub.remove();
}

/**
 * Enable system PiP while a real live is on screen.
 * iOS: VideoTrack `iosPIP.startAutomatically` (no JS).
 * Android: MainActivity enters PiP on Home when enabled.
 * Closing the Android PiP bubble while the app is in background leaves the live.
 */
export function useViewerSystemPip(enabled: boolean, onDismiss?: () => void) {
  const [active, setActive] = useState(false);
  const startedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    setAndroidLivePipEnabled(enabled);
    if (!enabled) {
      startedRef.current = false;
      setActive(false);
      void dismissAndroidLivePip();
    }
    return () => {
      setAndroidLivePipEnabled(false);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeAndroidLivePip((pipActive) => {
      if (pipActive) {
        startedRef.current = true;
        setActive(true);
        return;
      }
      const had = startedRef.current;
      startedRef.current = false;
      setActive(false);
      if (!had) return;
      const appActive = AppState.currentState === "active";
      if (!appActive) onDismissRef.current?.();
    });
  }, [enabled]);

  return { active };
}
