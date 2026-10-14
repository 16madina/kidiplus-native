import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { JPEG_QUALITY, MAX_IMAGE_SIDE, fitWithin, isPngMime } from "./compress-image-logic";

export type CompressOptions = {
  /** Keep PNG sources as PNG (transparent cut-outs, overlays). Default: everything becomes JPEG. */
  keepPng?: boolean;
};

export type CompressedUri = {
  uri: string;
  contentType: string;
  ext: string;
  width: number;
  height: number;
};

export type CompressedBlob = {
  blob: Blob;
  contentType: string;
  ext: string;
  width: number;
  height: number;
};

/**
 * Resize + re-encode a local photo before upload (native).
 * Returns null when nothing could be done; callers then send the original.
 *
 * `expo-image-manipulator` is required lazily and only when its native module
 * is in the binary: evaluating the package without it throws.
 */
export async function compressImageUri(
  uri: string,
  mime: string | null | undefined,
  opts: CompressOptions = {},
): Promise<CompressedUri | null> {
  if (Platform.OS === "web") return null;
  if (!requireOptionalNativeModule("ExpoImageManipulator")) return null;
  try {
    const { ImageManipulator, SaveFormat } =
      require("expo-image-manipulator") as typeof import("expo-image-manipulator");
    const asPng = !!opts.keepPng && isPngMime(mime);
    const context = ImageManipulator.manipulate(uri);
    let image = await context.renderAsync();
    // Resize from the rendered size (EXIF-rotated), not the picker's numbers.
    if (fitWithin(image.width, image.height)) {
      const landscape = image.width >= image.height;
      image.release();
      context.resize(landscape ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE });
      image = await context.renderAsync();
    }
    const saved = await image.saveAsync(
      asPng ? { format: SaveFormat.PNG } : { format: SaveFormat.JPEG, compress: JPEG_QUALITY },
    );
    image.release();
    context.release();
    if (!saved?.uri) return null;
    return {
      uri: saved.uri,
      contentType: asPng ? "image/png" : "image/jpeg",
      ext: asPng ? "png" : "jpg",
      width: saved.width,
      height: saved.height,
    };
  } catch {
    return null;
  }
}

/** Same as compressImageUri for the web build (canvas). */
export async function compressImageBlob(
  blob: Blob,
  opts: CompressOptions = {},
): Promise<CompressedBlob | null> {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  if (typeof createImageBitmap !== "function") return null;
  try {
    const asPng = !!opts.keepPng && isPngMime(blob.type);
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const target = fitWithin(bitmap.width, bitmap.height);
    const width = target?.width ?? bitmap.width;
    const height = target?.height ?? bitmap.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (!asPng) {
      // JPEG has no alpha: flatten on white instead of black.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const contentType = asPng ? "image/png" : "image/jpeg";
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, contentType, asPng ? undefined : JPEG_QUALITY),
    );
    if (!out || out.size === 0) return null;
    // Already small and well compressed: keep the original bytes.
    if (!target && out.size >= blob.size) return null;
    return { blob: out, contentType, ext: asPng ? "png" : "jpg", width, height };
  } catch {
    return null;
  }
}
