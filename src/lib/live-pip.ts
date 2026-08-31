import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { KidiLivePip } from "../../modules/kidi-live-pip/src";
import { liveSystemPipOn } from "./live-viewer-media";

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

export function subscribeAndroidLivePipPrepare(cb: () => void): () => void {
  if (!androidLivePipAvailable() || !KidiLivePip?.addListener) return () => undefined;
  const sub = KidiLivePip.addListener("onPipPrepare", () => cb());
  return () => sub.remove();
}

/**
 * Enable system PiP while a real live is on screen.
 * iOS: `preparing` goes true on AppState inactive/background (full screen *or*
 * in-app mini) so the host VideoTrack can turn `iosPIP` on. LivePipShell
 * expands to full size while `systemPip` is true so AVKit sees a real source.
 * `iosPIP` must stay off while the 118×210 mini is on screen.
 * Android: MainActivity enters PiP on Home after `onPipPrepare` expands the video.
 * Closing the Android PiP bubble while the app is in background leaves the live.
 */
export function useViewerSystemPip(enabled: boolean, onDismiss?: () => void) {
  const [active, setActive] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const startedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    setAndroidLivePipEnabled(enabled);
    if (!enabled) {
      startedRef.current = false;
      setActive(false);
      setPreparing(false);
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
        setPreparing(false);
        return;
      }
      const had = startedRef.current;
      startedRef.current = false;
      setActive(false);
      setPreparing(false);
      if (!had) return;
      const appActive = AppState.currentState === "active";
      if (!appActive) onDismissRef.current?.();
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const prepare = () => setPreparing(true);
    const unsubNative = subscribeAndroidLivePipPrepare(prepare);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "inactive" || state === "background") prepare();
      else if (state === "active" && !startedRef.current) setPreparing(false);
    });
    return () => {
      unsubNative();
      sub.remove();
    };
  }, [enabled]);

  return { active, preparing, systemPip: liveSystemPipOn(active, preparing) };
}
