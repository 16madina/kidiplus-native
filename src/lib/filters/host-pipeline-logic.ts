/** Pure host-pipeline helpers — no React Native imports (unit-tested in Node). */

import type { Lens } from "./lenses-catalog";

export type HostPipelineMode = "effects" | "snap" | "raw";
export type HostPublishPath = "kit_publish" | "web_overlay";

export type KitLens = Pick<Lens, "lensId" | "groupId" | "isSnapLens">;

export type KitPublishDeps = {
  os: string;
  cameraKit: boolean;
  startPreview: (facing: "user" | "environment") => Promise<void>;
  setPublish: (opts: { enabled: boolean; roomUrl?: string; token?: string }) => Promise<void>;
  getStatus: () => Promise<Record<string, unknown> | null>;
  applyLens: (lens: KitLens) => Promise<void>;
  allowNativeLens: (allowed: boolean) => void;
};

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
 * Android Camera Kit owns the camera for the whole live (even unfiltered),
 * like kidiplus.com. iOS `setPublishEnabled` is a stub — do not steal the
 * camera there or viewers get a black frame.
 */
export function canAttemptKitPublish(os: string, cameraKit: boolean): boolean {
  return os === "android" && cameraKit;
}

/** Android reports real published frames. iOS status has neither field. */
export function kitPublishConfirmed(status: Record<string, unknown> | null | undefined): boolean {
  if (!status) return false;
  return status.publishing === true && Number(status.frameCount ?? 0) > 0;
}

export async function runFilteredPublish(
  args: {
    url: string;
    token: string;
    facing: "user" | "environment";
    lens: KitLens | null;
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
    const status = await deps.getStatus();
    if (!kitPublishConfirmed(status)) {
      await deps.setPublish({ enabled: false }).catch(() => undefined);
      return { path: "web_overlay" };
    }
    if (args.lens?.isSnapLens && args.lens.lensId !== "none") {
      await deps.applyLens(args.lens).catch(() => undefined);
    }
    return { path: "kit_publish" };
  } catch {
    await deps.setPublish({ enabled: false }).catch(() => undefined);
    return { path: "web_overlay" };
  }
}
