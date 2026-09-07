import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  KidiLivePip,
  type PipEnableOptions,
  type PipNativeStatus,
} from "../../modules/kidi-live-pip/src";
import { livePipViewerIdentity } from "./livekit-identity";
import { fetchLiveKitSession } from "./livekit";
import { liveSystemPipOn } from "./live-viewer-media";

export type ViewerSystemPipSession = {
  roomName: string;
  userId: string | null;
  displayName: string;
};

/** Native system PiP module (Android Activity or iOS LivePipSession). */
export function nativeLivePipAvailable(): boolean {
  try {
    return !!KidiLivePip?.isSupported();
  } catch {
    return false;
  }
}

/** @deprecated use nativeLivePipAvailable — kept for existing Android call sites */
export function androidLivePipAvailable(): boolean {
  if (Platform.OS !== "android") return false;
  return nativeLivePipAvailable();
}

export async function setNativeLivePipEnabled(options: PipEnableOptions): Promise<boolean> {
  if (!KidiLivePip) return false;
  try {
    const result = await Promise.resolve(KidiLivePip.setEnabled(options));
    if (!options.enabled) return true;
    if (typeof result === "boolean") return result;
    return result.connected ?? result.enabled;
  } catch (error) {
    console.warn("[pip] native setEnabled failed", error);
    return false;
  }
}

export function setAndroidLivePipEnabled(enabled: boolean) {
  if (Platform.OS !== "android" || !androidLivePipAvailable()) return;
  void setNativeLivePipEnabled({ enabled });
}

export async function enterNativeLivePip(): Promise<boolean> {
  if (!nativeLivePipAvailable()) return false;
  try {
    return (await KidiLivePip?.enter()) ?? false;
  } catch {
    return false;
  }
}

async function readNativeLivePipStatus(): Promise<PipNativeStatus | null> {
  if (!KidiLivePip?.getStatus) return null;
  try {
    return await KidiLivePip.getStatus();
  } catch {
    return null;
  }
}

export async function enterAndroidLivePip(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return enterNativeLivePip();
}

export async function dismissNativeLivePip(): Promise<void> {
  if (!KidiLivePip) return;
  try {
    await setNativeLivePipEnabled({ enabled: false });
    await KidiLivePip.dismiss();
  } catch {
    /* ignore */
  }
}

export async function dismissAndroidLivePip(): Promise<void> {
  if (Platform.OS !== "android") return;
  await dismissNativeLivePip();
}

export function subscribeNativeLivePip(cb: (active: boolean) => void): () => void {
  if (!KidiLivePip?.addListener) return () => undefined;
  const sub = KidiLivePip.addListener("onPipModeChange", (e) => cb(!!e.active));
  return () => sub.remove();
}

export function subscribeAndroidLivePip(cb: (active: boolean) => void): () => void {
  if (Platform.OS !== "android") return () => undefined;
  return subscribeNativeLivePip(cb);
}

export function subscribeAndroidLivePipPrepare(cb: () => void): () => void {
  if (Platform.OS !== "android" || !KidiLivePip?.addListener) return () => undefined;
  const sub = KidiLivePip.addListener("onPipPrepare", () => cb());
  return () => sub.remove();
}

/**
 * Enable system PiP while a real live is on screen.
 *
 * iOS: connect the native LivePipSession (own LiveKit viewer + token `-pip`)
 * as soon as the live opens. The Swift module listens to willResignActive /
 * didEnterBackground itself — do not wait for Home. RN iosPIP is unused.
 *
 * Android: MainActivity enters PiP on Home after `onPipPrepare` expands the video.
 * Closing the Android PiP bubble while the app is in background leaves the live.
 */
export function useViewerSystemPip(
  enabled: boolean,
  session: ViewerSystemPipSession | null,
  onDismiss?: () => void,
  onRestore?: () => void,
) {
  const [active, setActive] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const startedRef = useRef(false);
  const iosReadyRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const guestPipIdRef = useRef(livePipViewerIdentity(null));
  const displayNameRef = useRef(session?.displayName ?? "Invité");
  displayNameRef.current = session?.displayName ?? "Invité";
  const roomName = session?.roomName ?? null;
  const userId = session?.userId ?? null;
  const pipIdentity = userId ? livePipViewerIdentity(userId) : guestPipIdRef.current;
  const sessionKey = enabled && roomName ? `${roomName}|${pipIdentity}` : null;
  const lastSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "android") {
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
    }

    if (Platform.OS !== "ios") return;

    if (!sessionKey || !KidiLivePip) {
      lastSessionKeyRef.current = null;
      startedRef.current = false;
      iosReadyRef.current = false;
      setActive(false);
      setPreparing(false);
      void dismissNativeLivePip();
      return;
    }

    // Same room + identity: do not teardown/reconnect. displayName must not
    // be a dep — profile hydrate used to kill the native session mid-live.
    if (lastSessionKeyRef.current === sessionKey && iosReadyRef.current) {
      return;
    }

    const prevKey = lastSessionKeyRef.current;
    lastSessionKeyRef.current = sessionKey;
    let cancelled = false;
    void (async () => {
      if (prevKey && prevKey !== sessionKey) {
        await dismissNativeLivePip();
        if (cancelled) return;
      }
      try {
        const lk = await fetchLiveKitSession(
          roomName!,
          pipIdentity,
          displayNameRef.current,
          "viewer",
        );
        if (cancelled) return;
        console.info("[pip] setEnabled once", { key: sessionKey });
        const connected = await setNativeLivePipEnabled({
          enabled: true,
          url: lk.url,
          token: lk.token,
        });
        if (!connected) {
          if (!cancelled) iosReadyRef.current = false;
          console.warn("[pip] iOS native room did not connect", { key: sessionKey });
          return;
        }
        // Connection alone is not PiP readiness. Wait for the subscribed host
        // track, the first decoded frame and AVKit's `possible` state.
        for (let attempt = 0; attempt < 50 && !cancelled; attempt += 1) {
          const status = await readNativeLivePipStatus();
          if (status?.ready) {
            iosReadyRef.current = true;
            console.info("[pip] iOS native PiP ready", {
              key: sessionKey,
              possible: status.possible,
              sourceVisible: status.sourceVisible,
            });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!cancelled) {
          iosReadyRef.current = false;
          console.warn("[pip] iOS native PiP not ready after first-frame wait", {
            key: sessionKey,
          });
        }
      } catch (e) {
        if (!cancelled) iosReadyRef.current = false;
        console.warn("[pip] iOS native token/connect failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, pipIdentity, roomName, sessionKey]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeNativeLivePip((pipActive) => {
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
      // `didBecomeActive` may stop native PiP a moment before React Native's
      // AppState reaches "active". Recheck after the transition so a normal
      // return to the app does not accidentally close the live.
      setTimeout(() => {
        if (startedRef.current) return;
        if (AppState.currentState === "active") {
          onRestoreRef.current?.();
        } else {
          onDismissRef.current?.();
        }
      }, 300);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // iOS: native LivePipSession owns Home→PiP. Keep RN audio alive until
    // native confirms `PiP did start`; otherwise a failed native connection
    // would leave the user with neither a bubble nor sound.
    if (Platform.OS === "ios") {
      if (!KidiLivePip) return;
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          if (startedRef.current) {
            startedRef.current = false;
            setActive(false);
            setPreparing(false);
            onRestoreRef.current?.();
            return;
          }
        }
      });
      return () => {
        sub.remove();
      };
    }
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
