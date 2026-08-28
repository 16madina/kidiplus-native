import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { pickImageFromLibrary } from "../pick-image";
import {
  clampPosterTransform,
  DEFAULT_POSTER_TRANSFORM,
  type BackgroundMode,
  type PosterMode,
  type PosterTransform,
} from "./live-effects-compositor";
import {
  isNativeLiveEffectsSupported,
  subscribeNativeLiveEffectsUnavailable,
  warmupNativeLiveEffects,
} from "./live-effects-native-bridge";

export type { BackgroundMode, PosterMode, PosterTransform };
export { clampPosterTransform, DEFAULT_POSTER_TRANSFORM };

export type LiveEffectsState = {
  backgroundUrl: string | null;
  backgroundMode: BackgroundMode;
  backgroundUnavailable: boolean;
  posterUrl: string | null;
  posterMode: PosterMode;
  posterTransform: PosterTransform;
  hasEffects: boolean;
  setBackgroundFromPicker: () => Promise<void>;
  setBackgroundBlur: (on: boolean) => void;
  markBackgroundUnavailable: () => void;
  clearBackground: () => void;
  setPosterFromPicker: () => Promise<void>;
  setPosterTransform: (t: PosterTransform) => void;
  clearPoster: () => void;
  clearAll: () => void;
};

const LiveEffectsContext = createContext<LiveEffectsState | null>(null);

export function LiveEffectsProvider({ children }: { children: ReactNode }) {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("none");
  const [backgroundUnavailable, setBackgroundUnavailable] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterMode, setPosterMode] = useState<PosterMode>("off");
  const [posterTransform, setPosterTransformRaw] = useState<PosterTransform>(
    DEFAULT_POSTER_TRANSFORM,
  );

  const markBackgroundUnavailable = useCallback(() => {
    setBackgroundUnavailable(true);
    setBackgroundMode("none");
    setBackgroundUrl(null);
  }, []);

  useEffect(() => subscribeNativeLiveEffectsUnavailable(markBackgroundUnavailable), [
    markBackgroundUnavailable,
  ]);

  const ensureNativeReady = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return true;
    if (backgroundUnavailable) return false;
    if (!isNativeLiveEffectsSupported()) {
      markBackgroundUnavailable();
      return false;
    }
    const ok = await warmupNativeLiveEffects();
    if (!ok) {
      markBackgroundUnavailable();
      return false;
    }
    return true;
  }, [backgroundUnavailable, markBackgroundUnavailable]);

  const setBackgroundFromPicker = useCallback(async () => {
    if (!(await ensureNativeReady())) return;
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setBackgroundUrl(picked.preview);
    setBackgroundMode("image");
  }, [ensureNativeReady]);

  const setBackgroundBlur = useCallback(
    (on: boolean) => {
      if (!on) {
        setBackgroundMode("none");
        return;
      }
      void (async () => {
        if (!(await ensureNativeReady())) return;
        setBackgroundMode("blur");
        setBackgroundUrl(null);
      })();
    },
    [ensureNativeReady],
  );

  const clearBackground = useCallback(() => {
    setBackgroundUrl(null);
    setBackgroundMode("none");
  }, []);

  const setPosterFromPicker = useCallback(async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setPosterUrl(picked.preview);
    setPosterMode("cover");
    setPosterTransformRaw(DEFAULT_POSTER_TRANSFORM);
  }, []);

  const setPosterTransform = useCallback((t: PosterTransform) => {
    setPosterTransformRaw(clampPosterTransform(t));
  }, []);

  const clearPoster = useCallback(() => {
    setPosterUrl(null);
    setPosterMode("off");
    setPosterTransformRaw(DEFAULT_POSTER_TRANSFORM);
  }, []);

  const clearAll = useCallback(() => {
    clearBackground();
    clearPoster();
  }, [clearBackground, clearPoster]);

  const value = useMemo<LiveEffectsState>(
    () => ({
      backgroundUrl,
      backgroundMode,
      backgroundUnavailable,
      posterUrl,
      posterMode,
      posterTransform,
      hasEffects:
        backgroundMode !== "none" || (!!posterUrl && posterMode !== "off"),
      setBackgroundFromPicker,
      setBackgroundBlur,
      markBackgroundUnavailable,
      clearBackground,
      setPosterFromPicker,
      setPosterTransform,
      clearPoster,
      clearAll,
    }),
    [
      backgroundUrl,
      backgroundMode,
      backgroundUnavailable,
      posterUrl,
      posterMode,
      posterTransform,
      setBackgroundFromPicker,
      setBackgroundBlur,
      markBackgroundUnavailable,
      clearBackground,
      setPosterFromPicker,
      setPosterTransform,
      clearPoster,
      clearAll,
    ],
  );

  return (
    <LiveEffectsContext.Provider value={value}>
      {children}
    </LiveEffectsContext.Provider>
  );
}

const EMPTY: LiveEffectsState = {
  backgroundUrl: null,
  backgroundMode: "none",
  backgroundUnavailable: false,
  posterUrl: null,
  posterMode: "off",
  posterTransform: DEFAULT_POSTER_TRANSFORM,
  hasEffects: false,
  setBackgroundFromPicker: async () => {},
  setBackgroundBlur: () => {},
  markBackgroundUnavailable: () => {},
  clearBackground: () => {},
  setPosterFromPicker: async () => {},
  setPosterTransform: () => {},
  clearPoster: () => {},
  clearAll: () => {},
};

export function useLiveEffects(): LiveEffectsState {
  return useContext(LiveEffectsContext) ?? EMPTY;
}
