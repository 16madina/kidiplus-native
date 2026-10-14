import type { CropRect } from "./publish-media";

/**
 * `expo-image-manipulator` (and `expo`) are required lazily, inside try/catch:
 * evaluating the package throws when its native module is not in the binary
 * (dev client built before the package was added). In that case the original
 * photo is published uncropped.
 */
type Manipulator = typeof import("expo-image-manipulator");

function loadManipulator(): Manipulator | null {
  try {
    const { requireOptionalNativeModule } = require("expo") as typeof import("expo");
    if (!requireOptionalNativeModule("ExpoImageManipulator")) return null;
    return require("expo-image-manipulator") as Manipulator;
  } catch {
    return null;
  }
}

export function isImageManipulatorAvailable(): boolean {
  return loadManipulator() != null;
}

function roundRect(rect: CropRect): CropRect {
  return {
    originX: Math.max(0, Math.floor(rect.originX)),
    originY: Math.max(0, Math.floor(rect.originY)),
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  };
}

async function cropOnWeb(uri: string, rect: CropRect): Promise<string> {
  const blob = await fetch(uri).then((r) => r.blob());
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return uri;
  ctx.drawImage(bitmap, rect.originX, rect.originY, rect.width, rect.height, 0, 0, rect.width, rect.height);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  return out && out.size > 0 ? URL.createObjectURL(out) : uri;
}

/** Cut the photo to the framed 9:16 area. Returns the original uri when cropping is unavailable. */
export async function cropCoverImage(uri: string, rect: CropRect): Promise<string> {
  const crop = roundRect(rect);
  try {
    if (typeof document !== "undefined" && typeof createImageBitmap === "function") {
      return await cropOnWeb(uri, crop);
    }
    const manipulator = loadManipulator();
    if (!manipulator) return uri;
    const context = manipulator.ImageManipulator.manipulate(uri);
    context.crop(crop);
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: manipulator.SaveFormat.JPEG, compress: 0.92 });
    image.release();
    context.release();
    return saved?.uri || uri;
  } catch {
    return uri;
  }
}
