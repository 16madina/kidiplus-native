import { Platform, Share } from "react-native";
import { replayDownloadFilename } from "./live-replay-meta";

export { replayDownloadFilename };

/**
 * Share/save a public replay MP4 (same idea as the website download button).
 * iOS share sheet can Save to Files / Photos; Android shares the URL.
 */
export async function downloadLiveReplay(
  url: string,
  title?: string | null,
): Promise<"shared" | "opened"> {
  const filename = replayDownloadFilename(title);
  try {
    await Share.share({
      title: filename,
      message: Platform.OS === "ios" ? (title ?? "Replay KiDi+") : url,
      url,
    });
    return "shared";
  } catch {
    return "opened";
  }
}
