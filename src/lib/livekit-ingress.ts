// Restream / OBS → LiveKit RTMP ingress — same /api/livekit-ingress as the site.

import { kidiplusJson } from "./kidiplus-api";

export type RtmpCredentials = {
  url: string;
  streamKey: string;
  ingressId: string;
  participantIdentity: string;
};

export async function createLiveIngress(liveId: string): Promise<RtmpCredentials> {
  const res = await kidiplusJson<RtmpCredentials>("/api/livekit-ingress", {
    method: "POST",
    body: { action: "create", liveId },
  });
  if (!res.ok) throw new Error(res.error);
  if (!res.data.url || !res.data.streamKey || !res.data.ingressId || !res.data.participantIdentity) {
    throw new Error("Ingress response incomplete");
  }
  return {
    url: res.data.url,
    streamKey: res.data.streamKey,
    ingressId: res.data.ingressId,
    participantIdentity: res.data.participantIdentity,
  };
}

export async function deleteLiveIngress(liveId: string): Promise<void> {
  const res = await kidiplusJson("/api/livekit-ingress", {
    method: "POST",
    body: { action: "delete", liveId },
  });
  if (!res.ok) throw new Error(res.error);
}
