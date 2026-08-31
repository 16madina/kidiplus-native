import assert from "node:assert/strict";
import {
  auctionSecondsLeft,
  formatBattleCardClock,
  peerStatusKey,
  pickBattleFeatured,
} from "./battle-featured.ts";
import type { LiveProductRow } from "./live-host.ts";

function product(over: Partial<LiveProductRow> = {}): LiveProductRow {
  return {
    id: "p1",
    live_id: "live1",
    name: "Robe",
    image_url: null,
    mode: "auction",
    start_price: 20,
    price: 20,
    stock: 1,
    timer_seconds: 30,
    status: "upcoming",
    sold_to_identity: null,
    final_price: null,
    position: 1,
    auction_deadline_at: null,
    ...over,
  };
}

function run() {
  assert.equal(formatBattleCardClock(75), "01:15");
  assert.equal(formatBattleCardClock(5), "00:05");
  assert.equal(peerStatusKey(product({ status: "active" })), "battle.card.statusLive");
  assert.equal(peerStatusKey(product({ status: "upcoming" })), "battle.card.statusWait");

  const sold = product({ id: "sold", status: "sold", position: 0 });
  const next = product({ id: "next", status: "upcoming", position: 2 });
  const live = product({
    id: "live",
    status: "active",
    position: 3,
    auction_deadline_at: new Date(Date.now() + 20_000).toISOString(),
  });
  assert.equal(pickBattleFeatured([sold, next, live])?.id, "live");
  assert.equal(pickBattleFeatured([sold, next])?.id, "next");
  assert.equal(pickBattleFeatured([sold]), null);

  const expired = product({
    id: "exp",
    status: "active",
    auction_deadline_at: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(pickBattleFeatured([expired, next])?.id, "next");
  assert.equal(auctionSecondsLeft(live) > 0, true);
  assert.equal(auctionSecondsLeft(expired), 0);
  console.log("battle-featured: all checks passed");
}

run();
