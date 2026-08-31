// YouTube OAuth + restream — same /api/youtube/* as kidiplus.com.

import { kidiplusJson, openKidiplusOAuth } from "./kidiplus-api";

export type YoutubeStatus = {
  connected: boolean;
  channelTitle?: string | null;
  channelId?: string | null;
};

export type YoutubeRestreamStart = {
  egressId: string;
  broadcastId: string;
  watchUrl: string;
  channelTitle?: string | null;
};

const YT_RETURN = "kidiplus://youtube-connected";

export async function fetchYoutubeStatus(): Promise<YoutubeStatus> {
  const res = await kidiplusJson<YoutubeStatus>("/api/youtube/status");
  if (!res.ok) throw new Error(res.error);
  return {
    connected: !!res.data.connected,
    channelTitle: res.data.channelTitle,
    channelId: res.data.channelId,
  };
}

export async function connectYoutube(returnPath = "/"): Promise<void> {
  const res = await kidiplusJson<{ url?: string }>("/api/youtube/oauth/start", {
    method: "POST",
    body: { native: true, returnPath },
  });
  if (!res.ok || !res.data.url) throw new Error(res.error || "OAuth start failed");
  const opened = await openKidiplusOAuth(res.data.url, YT_RETURN);
  if (opened === "cancel") throw new Error("cancelled");
}

export async function disconnectYoutube(): Promise<void> {
  const res = await kidiplusJson("/api/youtube/disconnect", { method: "POST", body: {} });
  if (!res.ok) throw new Error(res.error);
}

export async function startYoutubeRestream(liveId: string): Promise<YoutubeRestreamStart> {
  const res = await kidiplusJson<YoutubeRestreamStart & { error?: string }>("/api/youtube/restream", {
    method: "POST",
    body: { action: "start", liveId },
  });
  if (!res.ok) throw new Error(res.error);
  if (!res.data.egressId || !res.data.broadcastId || !res.data.watchUrl) {
    throw new Error("Restream response incomplete");
  }
  return {
    egressId: res.data.egressId,
    broadcastId: res.data.broadcastId,
    watchUrl: res.data.watchUrl,
    channelTitle: res.data.channelTitle,
  };
}

export async function stopYoutubeRestream(liveId: string): Promise<void> {
  const res = await kidiplusJson("/api/youtube/restream", {
    method: "POST",
    body: { action: "stop", liveId },
  });
  if (!res.ok) throw new Error(res.error);
}

export async function ensureYoutubeBroadcastLive(
  liveId: string,
  opts?: { maxAttempts?: number; intervalMs?: number; signal?: AbortSignal },
): Promise<{ ok: boolean; lifeCycleStatus: string | null }> {
  const maxAttempts = opts?.maxAttempts ?? 24;
  const intervalMs = opts?.intervalMs ?? 5_000;
  let lastStatus: string | null = null;

  for (let i = 0; i < maxAttempts; i++) {
    if (opts?.signal?.aborted) return { ok: false, lifeCycleStatus: lastStatus };
    try {
      const res = await kidiplusJson<{
        live?: boolean;
        ok?: boolean;
        lifeCycleStatus?: string | null;
      }>("/api/youtube/restream", {
        method: "POST",
        body: { action: "promote", liveId },
      });
      lastStatus = res.data.lifeCycleStatus ?? null;
      if (res.ok && (res.data.live || res.data.ok)) {
        return { ok: true, lifeCycleStatus: lastStatus };
      }
    } catch {
      if (opts?.signal?.aborted) return { ok: false, lifeCycleStatus: lastStatus };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ok: false, lifeCycleStatus: lastStatus };
}
