import { Platform } from "react-native";
import { KidiVideoExport } from "kidi-video-export";

export type PortraitVideo = { uri: string; contentType: "video/mp4"; ext: "mp4" };

/**
 * Re-encode a local video to 9:16 (720x1280 H.264, center crop) before upload.
 * Returns null on web, on binaries built without the native module, or when the
 * export fails; callers then upload the original file.
 */
export async function exportPortraitVideo(uri: string): Promise<PortraitVideo | null> {
  if (Platform.OS === "web" || !KidiVideoExport) return null;
  try {
    const out = await KidiVideoExport.exportPortrait({ uri });
    if (!out?.uri || !out.size) return null;
    return { uri: out.uri, contentType: "video/mp4", ext: "mp4" };
  } catch {
    return null;
  }
}
