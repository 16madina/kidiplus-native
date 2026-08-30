/** Pure host-pipeline helpers — no React Native imports (unit-tested in Node). */

import type { Lens } from "./lenses-catalog";

export type HostPipelineMode = "effects" | "snap" | "raw";
export type HostPublishPath = "kit_publish" | "web_overlay" | "kit_failed";

export type KitLens = Pick<Lens, "lensId" | "groupId" | "isSnapLens">;

export type KitPublishDeps = {
  os: string;
  cameraKit: boolean;
  startPreview: (facing: "user" | "environment") => Promise<void>;
  setPublish: (opts: { enabled: boolean; roomUrl?: string; token?: string }) => Promise<void>;
  getStatus: () => Promise<Record<string, unknown> | null>;
  applyLens: (lens: KitLens) => Promise<void>;
  allowNativeLens: (allowed: boolean) => void;
  confirmAttempts?: number;
  confirmDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Site classification: effects first, then Snap, else raw camera. */
export function hostPipelineMode(opts: {
  hasEffects: boolean;
  snapLens: boolean;
  cameraKit: boolean;
}): HostPipelineMode {
  if (opts.hasEffects) return "effects";
  if (opts.snapLens && opts.cameraKit) return "snap";
  return "raw";
}

/**
 * Phone Camera Kit owns the camera for the whole live (even unfiltered),
 * like kidiplus.com. Confirmed only when native status reports real frames.
 */
export function canAttemptKitPublish(os: string, cameraKit: boolean): boolean {
  return (os === "android" || os === "ios") && cameraKit;
}

/** Native publish is real when Camera Kit reports it is sending frames. */
export function kitPublishConfirmed(status: Record<string, unknown> | null | undefined): boolean {
  if (!status) return false;
  return status.publishing === true && Number(status.frameCount ?? 0) > 0;
}

function fallbackPath(os: string): HostPublishPath {
  // iOS + Camera Kit: never publish the raw JS camera (viewers would lose the
  // filter). Android still has a JS overlay fallback.
  return os === "ios" ? "kit_failed" : "web_overlay";
}

export async function waitForKitPublish(
  getStatus: () => Promise<Record<string, unknown> | null>,
  opts: { attempts: number; delayMs: number; sleep: (ms: number) => Promise<void> },
): Promise<Record<string, unknown> | null> {
  let last: Record<string, unknown> | null = null;
  for (let i = 0; i < opts.attempts; i++) {
    last = await getStatus();
    if (kitPublishConfirmed(last)) return last;
    if (i < opts.attempts - 1 && opts.delayMs > 0) await opts.sleep(opts.delayMs);
  }
  return last;
}

export async function runFilteredPublish(
  args: {
    url: string;
    token: string;
    facing: "user" | "environment";
    lens: KitLens | null;
    hasEffects?: boolean;
  },
  deps: KitPublishDeps,
): Promise<{ path: HostPublishPath }> {
  if (!canAttemptKitPublish(deps.os, deps.cameraKit)) {
    return { path: "web_overlay" };
  }
  deps.allowNativeLens(true);
  try {
    await deps.startPreview(args.facing);
    await deps.setPublish({
      enabled: true,
      roomUrl: args.url,
      token: args.token,
    });
    const status = await waitForKitPublish(deps.getStatus, {
      attempts: deps.confirmAttempts ?? 12,
      delayMs: deps.confirmDelayMs ?? 250,
      sleep: deps.sleep ?? defaultSleep,
    });
    if (!kitPublishConfirmed(status)) {
      await deps.setPublish({ enabled: false }).catch(() => undefined);
      return { path: fallbackPath(deps.os) };
    }
    if (!args.hasEffects && args.lens?.isSnapLens && args.lens.lensId !== "none") {
      await deps.applyLens(args.lens).catch(() => undefined);
    }
    return { path: "kit_publish" };
  } catch {
    await deps.setPublish({ enabled: false }).catch(() => undefined);
    return { path: fallbackPath(deps.os) };
  }
}
