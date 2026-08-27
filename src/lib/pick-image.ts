import { Platform } from "react-native";

export type PickedImage = {
  blob: Blob;
  preview: string;
  contentType: string;
  ext: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_BYTES = 5 * 1024 * 1024;

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
        const ext =
          (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        resolve({
          blob: file,
          preview: URL.createObjectURL(file),
          contentType: file.type || "image/jpeg",
          ext,
        });
      };
      input.click();
    });
  }
  return Promise.resolve(null);
}

export function assertImageSize(blob: Blob): void {
  if (blob.size > MAX_BYTES) {
    throw new Error("image_too_big");
  }
}
