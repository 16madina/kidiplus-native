export const LIVE_PIP_MINI = {
  width: 118,
  height: 210,
  right: 12,
  bottom: 72,
} as const;

export type LiveViewerPresentation = "full" | "minimized";
export type LivePipMode = "full" | "mini" | "system";

export function livePipMode(
  presentation: LiveViewerPresentation,
  systemPip: boolean,
): LivePipMode {
  if (systemPip) return "system";
  if (presentation === "minimized") return "mini";
  return "full";
}

/** Full-screen hardware back → mini. The on-screen X always leaves. */
export function liveViewerBackAction(presentation: LiveViewerPresentation): "minimize" | "close" {
  return presentation === "full" ? "minimize" : "close";
}

/** Swipe from the left edge to shrink the live (easier than a long drag). */
export const LIVE_EDGE_MINIMIZE = {
  catchDx: 6,
  catchDyMax: 40,
  dxOverDy: 1.1,
  releaseDx: 36,
  releaseVx: 0.3,
} as const;

export function liveEdgeShouldCatch(dx: number, dy: number): boolean {
  return (
    dx > LIVE_EDGE_MINIMIZE.catchDx &&
    Math.abs(dx) > Math.abs(dy) * LIVE_EDGE_MINIMIZE.dxOverDy &&
    Math.abs(dy) < LIVE_EDGE_MINIMIZE.catchDyMax
  );
}

export function liveEdgeShouldMinimize(dx: number, vx: number): boolean {
  return dx > LIVE_EDGE_MINIMIZE.releaseDx || vx > LIVE_EDGE_MINIMIZE.releaseVx;
}

/**
 * Keep every live in the list (same keys) so the current `LiveViewerScreen`
 * is not remounted when shrinking to the mini player.
 */
export function liveListItemLayout(
  compact: boolean,
  index: number,
  activeIndex: number,
  screenH: number,
): { length: number; offset: number; index: number } {
  if (!compact) return { length: screenH, offset: screenH * index, index };
  const h = LIVE_PIP_MINI.height;
  if (index < activeIndex) return { length: 0, offset: 0, index };
  if (index === activeIndex) return { length: h, offset: 0, index };
  return { length: 0, offset: h, index };
}

export function liveViewerChromeHidden(mode: LivePipMode): boolean {
  return mode !== "full";
}

/** Hide chat/bid chrome while the system PiP bubble is preparing or showing. */
export function liveViewerChromeHiddenForPip(
  presentation: LiveViewerPresentation,
  systemPip: boolean,
): boolean {
  return liveViewerChromeHidden(livePipMode(presentation, systemPip));
}
