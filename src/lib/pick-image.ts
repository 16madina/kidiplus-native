import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

export type PickedImage = {
  blob: Blob;
  preview: string;
  contentType: string;
  ext: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_BYTES = 5 * 1024 * 1024;

function extFromName(name: string | null | undefined, mime: string): string {
  const fromName = (name?.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  return "jpg";
}

async function blobFromUri(uri: string, mime: string): Promise<Blob> {
  const res = await fetch(uri);
  const blob = await res.blob();
  if (blob.type && blob.type !== "application/octet-stream") return blob;
  return new Blob([blob], { type: mime || "image/jpeg" });
}

export function pickImageFromLibrary(): Promise<PickedImage | null> {
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
        resolve({
          blob: file,
          preview: URL.createObjectURL(file),
          contentType: file.type || "image/jpeg",
          ext: extFromName(file.name, file.type),
        });
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
    const blob = await blobFromUri(asset.uri, contentType);
    return {
      blob,
      preview: asset.uri,
      contentType,
      ext: extFromName(asset.fileName, contentType),
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
        resolve({
          blob: file,
          preview: URL.createObjectURL(file),
          contentType: file.type || "image/jpeg",
          ext: extFromName(file.name, file.type),
        });
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
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.uri) return null;
    const contentType = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");
    const blob = await blobFromUri(asset.uri, contentType);
    return {
      blob,
      preview: asset.uri,
      contentType,
      ext: extFromName(asset.fileName, contentType),
    };
  })();
}

export function assertImageSize(blob: Blob): void {
  if (blob.size > MAX_BYTES) {
    throw new Error("image_too_big");
  }
}
