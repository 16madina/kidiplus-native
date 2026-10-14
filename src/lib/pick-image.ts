import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { compressImageBlob, compressImageUri, type CompressOptions } from "./compress-image";
import { pickerDurationToSec } from "./publish-media";

export type PickedImage = {
  blob: Blob;
  preview: string;
  contentType: string;
  ext: string;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_BYTES = 5 * 1024 * 1024;
// iOS re-encodes library videos to 720p H.264 before handing them over (Android: no-op).
const VIDEO_EXPORT_PRESET = ImagePicker.VideoExportPreset.H264_1280x720;

function extFromName(name: string | null | undefined, mime: string): string {
  const fromName = (name?.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  return "jpg";
}

export async function pickedMediaFromUri(
  uri: string,
  mime: string,
  fileName?: string | null,
  extra?: Pick<PickedImage, "durationSec" | "width" | "height">,
): Promise<PickedImage> {
  const contentType = mime || "image/jpeg";
  if (!contentType.startsWith("video/")) {
    return imageFromUri(uri, contentType, fileName, extra?.width, extra?.height);
  }
  return {
    blob: new Blob([new Uint8Array(0)], { type: contentType }),
    preview: uri,
    contentType,
    ext: extFromName(fileName, contentType),
    durationSec: extra?.durationSec,
    width: extra?.width,
    height: extra?.height,
  };
}

/** Local photo -> resized/compressed upload payload (original bytes if compression is unavailable). */
async function imageFromUri(
  uri: string,
  mime: string,
  fileName?: string | null,
  width?: number | null,
  height?: number | null,
  opts: CompressOptions = {},
): Promise<PickedImage> {
  const small = await compressImageUri(uri, mime, opts);
  if (small) {
    return {
      blob: await blobFromUri(small.uri, small.contentType),
      preview: small.uri,
      contentType: small.contentType,
      ext: small.ext,
      width: small.width,
      height: small.height,
    };
  }
  const blob = await blobFromUri(uri, mime);
  const webSmall = await imageFromWebBlob(blob, opts);
  if (webSmall) return webSmall;
  return { blob, preview: uri, contentType: mime, ext: extFromName(fileName, mime), width, height };
}

async function imageFromWebBlob(blob: Blob, opts: CompressOptions = {}): Promise<PickedImage | null> {
  const small = await compressImageBlob(blob, opts);
  if (!small) return null;
  return {
    blob: small.blob,
    preview: URL.createObjectURL(small.blob),
    contentType: small.contentType,
    ext: small.ext,
    width: small.width,
    height: small.height,
  };
}

/** Web <input type="file"> result -> upload payload; photos are compressed, videos are left as is. */
async function pickedFromWebFile(
  file: File,
  fallbackMime: string,
  opts: CompressOptions = {},
): Promise<PickedImage> {
  const contentType = file.type || fallbackMime;
  if (!contentType.startsWith("video/")) {
    const small = await imageFromWebBlob(file, opts);
    if (small) return small;
  }
  return {
    blob: file,
    preview: URL.createObjectURL(file),
    contentType,
    ext: extFromName(file.name, file.type),
  };
}

async function blobFromUri(uri: string, mime: string): Promise<Blob> {
  const res = await fetch(uri);
  const blob = await res.blob();
  if (blob.type && blob.type !== "application/octet-stream") return blob;
  return new Blob([blob], { type: mime || "image/jpeg" });
}

export function pickImageFromLibrary(opts: CompressOptions = {}): Promise<PickedImage | null> {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ACCEPT;
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        if (!file) {
          resolve(null);
          return;
        }
        void pickedFromWebFile(file, "image/jpeg", opts).then(resolve);
      };
      input.click();
    });
  }

  return (async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.88,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.uri) return null;
    const contentType = asset.mimeType || "image/jpeg";
    return imageFromUri(asset.uri, contentType, asset.fileName, asset.width, asset.height, opts);
  })();
}

export function pickVideoFromLibrary(maxDurationSec = 60): Promise<PickedImage | null> {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "video/mp4,video/quicktime,video/webm";
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        if (!file) {
          resolve(null);
          return;
        }
        void pickedFromWebFile(file, "video/mp4").then(resolve);
      };
      input.click();
    });
  }

  return (async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 0.88,
      videoMaxDuration: maxDurationSec,
      allowsEditing: Platform.OS === "ios",
      videoExportPreset: VIDEO_EXPORT_PRESET,
      exif: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.uri) return null;
    const contentType = asset.mimeType || "video/mp4";
    const blob = await blobFromUri(asset.uri, contentType);
    return {
      blob,
      preview: asset.uri,
      contentType,
      ext: extFromName(asset.fileName, contentType),
      durationSec: pickerDurationToSec(asset.duration),
      width: asset.width,
      height: asset.height,
    };
  })();
}

export function pickStoryMediaFromLibrary(): Promise<PickedImage | null> {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = `${ACCEPT},video/mp4,video/quicktime,video/webm`;
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        if (!file) {
          resolve(null);
          return;
        }
        void pickedFromWebFile(file, "image/jpeg").then(resolve);
      };
      input.click();
    });
  }

  return (async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.88,
      videoMaxDuration: 15,
      allowsEditing: Platform.OS === "ios",
      videoExportPreset: VIDEO_EXPORT_PRESET,
      exif: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.uri) return null;
    const contentType = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");
    const isVideo = asset.type === "video" || contentType.startsWith("video/");
    if (!isVideo) {
      return imageFromUri(asset.uri, contentType, asset.fileName, asset.width, asset.height);
    }
    // Don't load a whole video into RAM here — that was crashing KiDi+ on iPhone.
    return {
      blob: new Blob([new Uint8Array(0)], { type: contentType }),
      preview: asset.uri,
      contentType,
      ext: extFromName(asset.fileName, contentType),
      durationSec: pickerDurationToSec(asset.duration),
      width: asset.width,
      height: asset.height,
    };
  })();
}

export function assertImageSize(blob: Blob): void {
  if (blob.size > MAX_BYTES) {
    throw new Error("image_too_big");
  }
}
