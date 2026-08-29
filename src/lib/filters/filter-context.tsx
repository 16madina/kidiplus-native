import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SNAP_LENS_GROUP_ID } from "./camera-kit";
import {
  applyBridgeLens,
  clearBridgeLens,
  clearBridgeLensesCache,
  isCameraKitSupported,
  loadBridgeLenses,
} from "./camera-kit-bridge";
import { NONE_LENS, STYLE_LENSES, type Lens } from "./lenses-catalog";

type FilterContextValue = {
  activeLens: Lens;
  setActiveLens: (lens: Lens) => void;
  clearLens: () => void;
  /** Local tint for expo-camera overlay when Snap AR is unavailable. */
  tint: string;
  lenses: Lens[];
  loadLenses: () => void;
  refreshLenses: () => void;
  lensesLoading: boolean;
  lensesError: string | null;
  cameraKitReady: boolean;
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [activeLens, setActiveLensState] = useState<Lens>(NONE_LENS);
  const [snapLenses, setSnapLenses] = useState<Lens[]>([]);
  const [lensesLoading, setLensesLoading] = useState(false);
  const [lensesError, setLensesError] = useState<string | null>(null);
  const loadStartedRef = useRef(false);
  const cameraKitReady = isCameraKitSupported();

  const runLoad = useCallback((force: boolean) => {
    if (!force && loadStartedRef.current) return;
    if (!isCameraKitSupported()) {
      if (snapLenses.length === 0) {
        setLensesError(
          "Module Snap AR absent — lance npm run rebuild:ios sur ton Mac.",
        );
      }
      return;
    }
    loadStartedRef.current = true;
    setLensesLoading(true);
    setLensesError(null);
    loadBridgeLenses(force)
      .then((rows) => {
        setSnapLenses(
          rows.map((l) => ({
            lensId: l.lensId,
            groupId: l.groupId || SNAP_LENS_GROUP_ID,
            name: l.name || "Lens",
            icon: "✨",
            iconUrl: l.iconUrl || l.previewUrl || undefined,
            category: "snap" as const,
            isSnapLens: true,
          })),
        );
        if (rows.length === 0) {
          setLensesError("Aucune lens Snap dans le groupe — vérifie my-lenses.snapchat.com");
        }
      })
      .catch(() => {
        console.warn("[filters] snap lenses load failed");
        loadStartedRef.current = false;
        setLensesError("Impossible de charger les filtres AR. Réessaie.");
      })
      .finally(() => setLensesLoading(false));
  }, []);

  useEffect(() => {
    runLoad(false);
  }, [runLoad]);

  const loadLenses = useCallback(() => runLoad(false), [runLoad]);
  const refreshLenses = useCallback(() => {
    clearBridgeLensesCache();
    runLoad(true);
  }, [runLoad]);

  const setActiveLens = useCallback((lens: Lens) => {
    setActiveLensState(lens);
    void applyBridgeLens(lens).catch((e) => {
      console.warn("[filters] applyLens failed", e);
    });
  }, []);

  const clearLens = useCallback(() => {
    setActiveLensState(NONE_LENS);
    void clearBridgeLens();
  }, []);

  // Styles locaux (teintes) + lenses Snap. En live, seules les teintes
  // sont publiées aux viewers — Snap AR ouvrirait une 2e caméra.
  const lenses = useMemo(
    () => [NONE_LENS, ...STYLE_LENSES.filter((l) => l.lensId !== "none"), ...snapLenses],
    [snapLenses],
  );

  const value = useMemo<FilterContextValue>(
    () => ({
      activeLens,
      setActiveLens,
      clearLens,
      tint: activeLens.tint ?? "transparent",
      lenses,
      loadLenses,
      refreshLenses,
      lensesLoading,
      lensesError,
      cameraKitReady,
    }),
    [
      activeLens,
      setActiveLens,
      clearLens,
      lenses,
      loadLenses,
      refreshLenses,
      lensesLoading,
      lensesError,
      cameraKitReady,
    ],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
