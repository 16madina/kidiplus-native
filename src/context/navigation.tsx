import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LiveStream } from "../mock/lives";

export type TabKey = "home" | "search" | "live" | "vitrine" | "profile";
export type Overlay =
  | { kind: "none" }
  | { kind: "live"; stream: LiveStream; list: LiveStream[]; index: number }
  | { kind: "activity" }
  | { kind: "legal"; page: "terms" | "privacy" }
  | { kind: "shop"; sellerId?: string; sellerName?: string }
  | { kind: "wallet" }
  | { kind: "orders" }
  | { kind: "earnings" }
  | { kind: "settings" }
  | { kind: "help" }
  | { kind: "addresses" }
  | { kind: "broadcast-setup"; mode: "now" | "schedule" }
  | {
      kind: "broadcast-live";
      liveId: string;
      roomName: string;
      title: string;
      identity: string;
      displayName: string;
      facing: "front" | "back";
    }
  | { kind: "admin" };

type Ctx = {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  overlay: Overlay;
  openLive: (stream: LiveStream, list?: LiveStream[], index?: number) => void;
  openList: (list: LiveStream[], index: number) => void;
  openOverlay: (o: Exclude<Overlay, { kind: "none" }>) => void;
  closeOverlay: () => void;
};

const NavContext = createContext<Ctx | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabKey>("home");
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });

  const openLive = useCallback((stream: LiveStream, list?: LiveStream[], index?: number) => {
    setOverlay({
      kind: "live",
      stream,
      list: list ?? [stream],
      index: index ?? 0,
    });
  }, []);

  const openList = useCallback((list: LiveStream[], index: number) => {
    const stream = list[index];
    if (!stream) return;
    setOverlay({ kind: "live", stream, list, index });
  }, []);

  const openOverlay = useCallback((o: Exclude<Overlay, { kind: "none" }>) => {
    setOverlay(o);
  }, []);

  const closeOverlay = useCallback(() => setOverlay({ kind: "none" }), []);

  const value = useMemo<Ctx>(
    () => ({ tab, setTab, overlay, openLive, openList, openOverlay, closeOverlay }),
    [tab, overlay, openLive, openList, openOverlay, closeOverlay],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavigationProvider");
  return ctx;
}
