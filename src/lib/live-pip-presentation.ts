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

/** Full-screen back / X → keep watching in the corner. Mini X → leave. */
export function liveViewerBackAction(presentation: LiveViewerPresentation): "minimize" | "close" {
  return presentation === "full" ? "minimize" : "close";
}

export function liveViewerChromeHidden(mode: LivePipMode): boolean {
  return mode !== "full";
}
