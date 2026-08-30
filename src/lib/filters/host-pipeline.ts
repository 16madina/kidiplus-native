/** Same host video pipeline as kidiplus.com `broadcast-video.applyHostPipeline`. */

import { Platform } from "react-native";
import { KidiCameraKit } from "../../../modules/kidi-camera-kit/src";
import {
  applyBridgeLens,
  isCameraKitSupported,
  setBridgePublishEnabled,
  setNativeLensApplyAllowed,
  startBridgePreview,
} from "./camera-kit-bridge";
import {
  runFilteredPublish,
  type KitLens,
  type KitPublishDeps,
} from "./host-pipeline-logic";

export {
  canAttemptKitPublish,
  hostPipelineMode,
  kitPublishConfirmed,
  type HostPipelineMode,
  type HostPublishPath,
  type KitLens,
  type KitPublishDeps,
} from "./host-pipeline-logic";

function defaultDeps(): KitPublishDeps {
  return {
    os: Platform.OS,
    cameraKit: isCameraKitSupported(),
    startPreview: startBridgePreview,
    setPublish: setBridgePublishEnabled,
    getStatus: async () => {
      if (!KidiCameraKit) return null;
      return KidiCameraKit.getStatus().catch(() => null);
    },
    applyLens: applyBridgeLens,
    allowNativeLens: setNativeLensApplyAllowed,
  };
}

export async function tryStartFilteredPublish(args: {
  url: string;
  token: string;
  facing: "user" | "environment";
  lens: KitLens | null;
}): Promise<{ path: "kit_publish" | "web_overlay" }> {
  return runFilteredPublish(args, defaultDeps());
}

export async function stopFilteredPublish(): Promise<void> {
  await setBridgePublishEnabled({ enabled: false }).catch(() => undefined);
}
