import { supabase } from "./supabase";

export type LiveKitRole = "host" | "viewer";
export type LiveKitSession = { token: string; url: string };

const TOKEN_URL = "https://kidiplus.com/api/livekit-token";

export function makeRoomName(sellerId: string): string {
  const clean = sellerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "seller";
  return `live_${clean}_${Date.now().toString(36)}`;
}

export function guestLiveKitIdentity(): string {
  return `guest_${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchLiveKitSession(
  room: string,
  identity: string,
  name: string | undefined,
  role: LiveKitRole,
): Promise<LiveKitSession> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken && role === "host") {
    throw new Error("Connecte-toi pour lancer un live.");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ room, identity, name, role }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Jeton LiveKit refusé (${res.status})`);
  }
  const json = (await res.json()) as { token?: string; url?: string; error?: string };
  if (!json.token || !json.url) {
    throw new Error(json.error || "Réponse LiveKit invalide");
  }
  return { token: json.token, url: json.url };
}
