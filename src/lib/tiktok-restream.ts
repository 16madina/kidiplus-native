// TikTok manual RTMP restream — same /api/tiktok/restream as the site.

import { kidiplusJson } from "./kidiplus-api";

export type TiktokRestreamStart = {
  egressId: string;
};

export async function startTiktokRestream(opts: {
  liveId: string;
  serverUrl: string;
  streamKey: string;
}): Promise<TiktokRestreamStart> {
  const res = await kidiplusJson<{ egressId?: string }>("/api/tiktok/restream", {
    method: "POST",
    body: {
      action: "start",
      liveId: opts.liveId,
      serverUrl: opts.serverUrl,
      streamKey: opts.streamKey,
    },
  });
  if (!res.ok) throw new Error(res.error);
  if (!res.data.egressId) throw new Error("Restream response incomplete");
  return { egressId: res.data.egressId };
}

export async function stopTiktokRestream(liveId: string): Promise<void> {
  const res = await kidiplusJson("/api/tiktok/restream", {
    method: "POST",
    body: { action: "stop", liveId },
  });
  if (!res.ok) throw new Error(res.error);
}
