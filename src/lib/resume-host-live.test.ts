import assert from "node:assert/strict";
import { openLiveRowToOverlay, pickOpenLive, type OpenLiveRow } from "./open-live.ts";

function row(id: string, title = "Live"): OpenLiveRow {
  return {
    id,
    title,
    started_at: "2026-08-28T10:00:00.000Z",
    room_name: `room-${id}`,
    cover_url: null,
    category: "Fashion",
    currency: "EUR",
    host_last_seen_at: "2026-08-28T10:00:00.000Z",
    broadcast_mode: "camera",
    ingress_id: null,
    allow_gifts: true,
  };
}

function run() {
  const a = row("aaa", "Sneakers");
  const b = row("bbb", "Bijoux");
  assert.equal(pickOpenLive([], "aaa"), null);
  assert.equal(pickOpenLive([a, b], null)?.id, "aaa");
  assert.equal(pickOpenLive([a, b], "bbb")?.id, "bbb");
  assert.equal(pickOpenLive([a, b], "missing")?.id, "aaa");

  const overlay = openLiveRowToOverlay(b, { id: "seller-1", displayName: "  Awa  " });
  assert.equal(overlay.kind, "broadcast-live");
  assert.equal(overlay.liveId, "bbb");
  assert.equal(overlay.roomName, "room-bbb");
  assert.equal(overlay.title, "Bijoux");
  assert.equal(overlay.identity, "seller-1");
  assert.equal(overlay.displayName, "Awa");
  assert.equal(overlay.facing, "front");
}

run();
console.log("resume-host-live.test.ts ok");
