export type OpenLiveRow = {
  id: string;
  title: string;
  started_at: string;
  room_name: string;
  cover_url: string | null;
  category: string | null;
  currency: string | null;
  host_last_seen_at: string | null;
  broadcast_mode?: string | null;
  ingress_id?: string | null;
  allow_gifts?: boolean | null;
};

export type BroadcastLiveOverlay = {
  kind: "broadcast-live";
  liveId: string;
  roomName: string;
  title: string;
  identity: string;
  displayName: string;
  facing: "front" | "back";
  rtmpMode?: boolean;
};

export function pickOpenLive(rows: OpenLiveRow[], preferredId?: string | null): OpenLiveRow | null {
  if (!rows.length) return null;
  if (preferredId) return rows.find((r) => r.id === preferredId) ?? rows[0] ?? null;
  return rows[0] ?? null;
}

export function openLiveRowToOverlay(
  row: OpenLiveRow,
  user: { id: string; displayName: string },
): BroadcastLiveOverlay {
  return {
    kind: "broadcast-live",
    liveId: row.id,
    roomName: row.room_name,
    title: row.title,
    identity: user.id,
    displayName: user.displayName.trim() || "Vendeur",
    facing: "front",
    rtmpMode: row.broadcast_mode === "rtmp",
  };
}
