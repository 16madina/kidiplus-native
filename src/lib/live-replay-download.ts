import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

function safeReplayFilename(title?: string | null): string {
  const base = (title ?? "live")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const stamp = new Date().toISOString().slice(0, 10);
  return `kidiplus-${base || "live"}-${stamp}.mp4`;
}

/** Download the MP4, then open the native save/share sheet. */
export async function saveLiveReplayToDevice(
  url: string,
  title?: string | null,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("sharing_unavailable");
  }

  const destination = new File(Paths.cache, safeReplayFilename(title));
  const downloaded = await File.downloadFileAsync(url, destination, {
    idempotent: true,
  });

  await Sharing.shareAsync(downloaded.uri, {
    dialogTitle: title || "Replay KiDi+",
    mimeType: "video/mp4",
    UTI: "public.mpeg-4",
  });
}
