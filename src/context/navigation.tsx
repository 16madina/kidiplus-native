import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LiveViewerPresentation } from "../lib/live-pip-presentation";
import type { LiveStream } from "../mock/lives";
import type { DmChatTarget } from "../lib/dm";

export type TabKey = "home" | "search" | "live" | "vitrine" | "profile";

export type OverlayKind =
  | "live"
  | "activity"
  | "dm-chat"
  | "legal"
  | "shop"
  | "wallet"
  | "orders"
  | "earnings"
  | "settings"
  | "help"
  | "addresses"
  | "referral"
  | "edit-profile"
  | "certification"
  | "delivery"
  | "delete-account"
  | "broadcast-setup"
  | "broadcast-live"
  | "admin"
  | "blocked-users"
  | "seller-payments"
  | "seller-profile"
  | "discover";

export type Overlay =
  | { kind: "none" }
  | { kind: "live"; stream: LiveStream; list: LiveStream[]; index: number }
  | { kind: "activity"; tab?: "notifs" | "messages"; threadId?: string }
  | { kind: "dm-chat"; target: DmChatTarget }
  | { kind: "legal"; page: "terms" | "privacy" | "community" | "safety" }
  | { kind: "shop"; sellerId?: string; sellerName?: string }
  | { kind: "wallet" }
  | { kind: "orders"; orderId?: string }
  | { kind: "earnings" }
  | { kind: "settings" }
  | { kind: "help" }
  | { kind: "addresses" }
  | { kind: "referral" }
  | { kind: "edit-profile" }
  | { kind: "certification" }
  | { kind: "delivery" }
  | { kind: "delete-account" }
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
  | { kind: "admin" }
  | { kind: "blocked-users" }
  | { kind: "seller-payments" }
  | { kind: "seller-profile"; sellerId: string }
  | { kind: "discover" };

type OverlayEntry = Exclude<Overlay, { kind: "none" }>;

type Ctx = {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  /** Top of the overlay stack (or `{ kind: "none" }`). */
  overlay: Overlay;
  /** Full stack — used by AppShell to keep parents mounted. */
  overlayStack: OverlayEntry[];
  isOverlayOpen: (kind: OverlayKind) => boolean;
  findOverlay: <K extends OverlayKind>(kind: K) => Extract<OverlayEntry, { kind: K }> | undefined;
  openLive: (stream: LiveStream, list?: LiveStream[], index?: number) => void;
  openList: (list: LiveStream[], index: number) => void;
  /** full = immersive overlay; minimized = in-app mini player (LiveKit stays up). */
  livePresentation: LiveViewerPresentation;
  minimizeLive: () => void;
  expandLive: () => void;
  /** Unmount the live session (mini X, ended, block). */
  closeLive: () => void;
  /** Push (or replace if same kind already on top). Parent overlays stay underneath. */
  openOverlay: (o: OverlayEntry) => void;
  /** Pop the top overlay only. */
  closeOverlay: () => void;
  /** Clear the whole stack. */
  closeAllOverlays: () => void;
  pendingVitrinePostId: string | null;
  setPendingVitrinePostId: (id: string | null) => void;
};

const NavContext = createContext<Ctx | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabKey>("home");
  const [stack, setStack] = useState<OverlayEntry[]>([]);
  const [livePresentation, setLivePresentation] = useState<LiveViewerPresentation>("full");
  const [pendingVitrinePostId, setPendingVitrinePostId] = useState<string | null>(null);

  const overlay: Overlay = stack.length ? stack[stack.length - 1]! : { kind: "none" };

  const isOverlayOpen = useCallback(
    (kind: OverlayKind) => stack.some((o) => o.kind === kind),
    [stack],
  );

  const findOverlay = useCallback(
    <K extends OverlayKind>(kind: K) =>
      [...stack].reverse().find((o): o is Extract<OverlayEntry, { kind: K }> => o.kind === kind),
    [stack],
  );

  const pushOverlay = useCallback((o: OverlayEntry) => {
    setStack((prev) => {
      const idx = prev.findIndex((x) => x.kind === o.kind);
      // Already in stack → replace that entry and drop anything above it
      // (e.g. re-open Activity while a DM is on top → close the DM).
      if (idx >= 0) return [...prev.slice(0, idx), o];
      return [...prev, o];
    });
  }, []);

  const openLive = useCallback(
    (stream: LiveStream, list?: LiveStream[], index?: number) => {
      setLivePresentation("full");
      pushOverlay({
        kind: "live",
        stream,
        list: list ?? [stream],
        index: index ?? 0,
      });
    },
    [pushOverlay],
  );

  const openList = useCallback(
    (list: LiveStream[], index: number) => {
      const stream = list[index];
      if (!stream) return;
      setLivePresentation("full");
      pushOverlay({ kind: "live", stream, list, index });
    },
    [pushOverlay],
  );

  const minimizeLive = useCallback(() => {
    setLivePresentation("minimized");
  }, []);

  const expandLive = useCallback(() => {
    setLivePresentation("full");
  }, []);

  const closeLive = useCallback(() => {
    setLivePresentation("full");
    setStack((prev) => prev.filter((o) => o.kind !== "live"));
  }, []);

  const openOverlay = useCallback(
    (o: OverlayEntry) => {
      pushOverlay(o);
    },
    [pushOverlay],
  );

  const closeOverlay = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const closeAllOverlays = useCallback(() => {
    setLivePresentation("full");
    setStack([]);
  }, []);

  useEffect(() => {
    if (!stack.some((o) => o.kind === "live") && livePresentation !== "full") {
      setLivePresentation("full");
    }
  }, [stack, livePresentation]);

  const value = useMemo<Ctx>(
    () => ({
      tab,
      setTab,
      overlay,
      overlayStack: stack,
      isOverlayOpen,
      findOverlay,
      openLive,
      openList,
      livePresentation,
      minimizeLive,
      expandLive,
      closeLive,
      openOverlay,
      closeOverlay,
      closeAllOverlays,
      pendingVitrinePostId,
      setPendingVitrinePostId,
    }),
    [
      tab,
      overlay,
      stack,
      isOverlayOpen,
      findOverlay,
      openLive,
      openList,
      livePresentation,
      minimizeLive,
      expandLive,
      closeLive,
      openOverlay,
      closeOverlay,
      closeAllOverlays,
      pendingVitrinePostId,
    ],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavigationProvider");
  return ctx;
}
