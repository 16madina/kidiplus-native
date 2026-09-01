import { supabase } from "./supabase";

const API = "https://kidiplus.com/api/live-replay";

export type LiveReplayStatus =
  | "recording"
  | "processing"
  | "ready"
  | "failed"
  | "expired"
  | null;

export type LiveReplayMeta = {
  replay_status: LiveReplayStatus;
  replay_url: string | null;
  replay_expires_at: string | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function startLiveReplay(liveId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/start`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ liveId }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
    if (!res.ok || body.ok === false) {
      return { ok: false, error: body.message || body.error || `start failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function stopLiveReplay(liveId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/stop`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ liveId }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      return { ok: false, error: body.message || body.error || `stop failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchLiveReplayMeta(liveId: string): Promise<LiveReplayMeta | null> {
  const { data, error } = await supabase
    .from("lives")
    .select("replay_status, replay_url, replay_expires_at")
    .eq("id", liveId)
    .maybeSingle();
  if (error || !data) return null;
  const status = (data.replay_status ?? null) as LiveReplayStatus;
  const expires = (data.replay_expires_at as string | null) ?? null;
  if (status === "ready" && expires && new Date(expires).getTime() <= Date.now()) {
    return { replay_status: "expired", replay_url: null, replay_expires_at: expires };
  }
  return {
    replay_status: status,
    replay_url: (data.replay_url as string | null) ?? null,
    replay_expires_at: expires,
  };
}

export async function resolvePlayableReplayUrl(liveId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/play-url?liveId=${encodeURIComponent(liveId)}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { url?: string };
    return typeof body.url === "string" && body.url ? body.url : null;
  } catch {
    return null;
  }
}

export function isReplayPlayable(meta: LiveReplayMeta | null | undefined): boolean {
  if (meta?.replay_status !== "ready") return false;
  if (meta.replay_expires_at && new Date(meta.replay_expires_at).getTime() <= Date.now()) return false;
  return true;
}

export { replayDaysLeft } from "./live-replay-meta";

export async function deleteLiveReplay(liveId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/delete`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ liveId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: body.message || body.error || `delete failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function looksPrivateReplayUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("r2.cloudflarestorage.com") || (host.endsWith(".amazonaws.com") && host.includes("s3"));
  } catch {
    return false;
  }
}

export async function playableReplayUrl(
  liveId: string,
  meta: Pick<LiveReplayMeta, "replay_url"> | LiveReplayMeta | null,
): Promise<string | null> {
  const signed = await resolvePlayableReplayUrl(liveId);
  if (signed) return signed;
  const url = meta?.replay_url ?? null;
  if (url && !looksPrivateReplayUrl(url)) return url;
  return null;
}
