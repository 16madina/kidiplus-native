import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { pickImageFromLibrary } from "../pick-image";

export type PosterTransform = { x: number; y: number; scale: number };
export const DEFAULT_POSTER_TRANSFORM: PosterTransform = { x: 0.5, y: 0.4, scale: 1 };

export function clampPosterTransform(t: PosterTransform): PosterTransform {
  return {
    x: Math.min(0.95, Math.max(0.05, t.x)),
    y: Math.min(0.95, Math.max(0.05, t.y)),
    scale: Math.min(3, Math.max(0.35, t.scale)),
  };
}

export type BackgroundMode = "none" | "blur" | "image";
export type PosterMode = "off" | "cover";

export type LiveEffectsState = {
  backgroundUrl: string | null;
  backgroundMode: BackgroundMode;
  posterUrl: string | null;
  posterMode: PosterMode;
  posterTransform: PosterTransform;
  hasEffects: boolean;
  setBackgroundFromPicker: () => Promise<void>;
  setBackgroundBlur: (on: boolean) => void;
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
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterMode, setPosterMode] = useState<PosterMode>("off");
  const [posterTransform, setPosterTransformRaw] = useState<PosterTransform>(
    DEFAULT_POSTER_TRANSFORM,
  );

  const setBackgroundFromPicker = useCallback(async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setBackgroundUrl(picked.preview);
    setBackgroundMode("image");
  }, []);

  const setBackgroundBlur = useCallback((on: boolean) => {
    setBackgroundMode(on ? "blur" : "none");
    if (on) setBackgroundUrl(null);
  }, []);

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
      posterUrl,
      posterMode,
      posterTransform,
      hasEffects:
        backgroundMode !== "none" || (!!posterUrl && posterMode !== "off"),
      setBackgroundFromPicker,
      setBackgroundBlur,
      clearBackground,
      setPosterFromPicker,
      setPosterTransform,
      clearPoster,
      clearAll,
    }),
    [
      backgroundUrl,
      backgroundMode,
      posterUrl,
      posterMode,
      posterTransform,
      setBackgroundFromPicker,
      setBackgroundBlur,
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
  posterUrl: null,
  posterMode: "off",
  posterTransform: DEFAULT_POSTER_TRANSFORM,
  hasEffects: false,
  setBackgroundFromPicker: async () => {},
  setBackgroundBlur: () => {},
  clearBackground: () => {},
  setPosterFromPicker: async () => {},
  setPosterTransform: () => {},
  clearPoster: () => {},
  clearAll: () => {},
};

export function useLiveEffects(): LiveEffectsState {
  return useContext(LiveEffectsContext) ?? EMPTY;
}
