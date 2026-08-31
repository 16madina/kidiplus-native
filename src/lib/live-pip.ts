import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { AudioSession } from "@livekit/react-native";
import { KidiLivePip, type PipEnableOptions } from "../../modules/kidi-live-pip/src";
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

export async function setNativeLivePipEnabled(options: PipEnableOptions): Promise<void> {
  if (!KidiLivePip) return;
  try {
    await Promise.resolve(KidiLivePip.setEnabled(options));
  } catch {
    /* native module missing or rejected in this binary */
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

async function muteRnViewerAudio(mute: boolean): Promise<void> {
  try {
    await AudioSession.setDefaultRemoteAudioTrackVolume(mute ? 0 : 1);
  } catch {
    /* audio session not started yet */
  }
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
) {
  const [active, setActive] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const startedRef = useRef(false);
  const iosReadyRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
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
      await new Promise((r) => setTimeout(r, 350));
      if (cancelled) return;
      try {
        const lk = await fetchLiveKitSession(
          roomName!,
          pipIdentity,
          displayNameRef.current,
          "viewer",
        );
        if (cancelled) return;
        console.info("[pip] setEnabled once", { key: sessionKey });
        await setNativeLivePipEnabled({
          enabled: true,
          url: lk.url,
          token: lk.token,
        });
        if (!cancelled) iosReadyRef.current = true;
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
      const appActive = AppState.currentState === "active";
      if (!appActive) onDismissRef.current?.();
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // iOS: native LivePipSession owns Home→PiP. Expanding the RN mini
    // (the old iosPIP trick) is no longer needed and caused a black mini.
    if (Platform.OS === "ios") {
      if (!KidiLivePip) return;
      const sub = AppState.addEventListener("change", (state) => {
        if (!iosReadyRef.current) return;
        if (state === "inactive" || state === "background") {
          void muteRnViewerAudio(true);
        } else if (state === "active") {
          void muteRnViewerAudio(false);
        }
      });
      return () => {
        sub.remove();
        void muteRnViewerAudio(false);
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
