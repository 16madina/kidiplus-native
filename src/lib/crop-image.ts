import { requireOptionalNativeModule } from "expo-modules-core";
import type { CropRect } from "./publish-media";

type Manipulator = typeof import("expo-image-manipulator");

function loadManipulator(): Manipulator | null {
  // The JS package calls requireNativeModule() at import time. Gate on the
  // native binary first so Metro can load Vitrine without a rebuild.
  try {
    if (!requireOptionalNativeModule("ExpoImageManipulator")) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-image-manipulator") as Manipulator;
  } catch {
    return null;
  }
}

export function isImageManipulatorAvailable(): boolean {
  return loadManipulator() != null;
}

/** Crop + resize. If the native module is not in this binary, return the original URI. */
export async function cropCoverImage(uri: string, rect: CropRect): Promise<string> {
  const mod = loadManipulator();
  if (!mod) return uri;
  const originX = Math.max(0, Math.round(rect.originX));
  const originY = Math.max(0, Math.round(rect.originY));
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const result = await mod.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width, height } }, { resize: { width: 1080 } }],
    { compress: 0.86, format: mod.SaveFormat.JPEG },
  );
  if (!result.uri) throw new Error("crop_failed");
  return result.uri;
}
