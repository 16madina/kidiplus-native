import assert from "node:assert/strict";
import { battleResultView, fighterHasSales, isLeaveReason } from "./battle-result.ts";
import type { HydratedBattle } from "./battles.ts";

function battle(over: Partial<HydratedBattle["session"]> = {}, scores = { a: 40, b: 10 }): HydratedBattle {
  return {
    session: {
      id: "b1",
      status: "ended",
      duration_sec: 900,
      started_at: new Date().toISOString(),
      ends_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      currency: "CAD",
      live_winner_seller_id: "seller-a",
      winner_seller_id: null,
      end_reason: "timeout",
      sudden_death: false,
      rematch_of_battle_id: null,
      turn_side: null,
      turn_until: null,
      last_sale_text: null,
      last_sale_at: null,
      sudden_death_at: null,
      ...over,
    },
    lives: [
      {
        battle_id: "b1",
        live_id: "la",
        seller_id: "seller-a",
        side: "a",
        active: false,
        room_name: "ra",
        display_name: "Aïcha",
        handle: null,
        avatar_url: null,
      },
      {
        battle_id: "b1",
        live_id: "lb",
        seller_id: "seller-b",
        side: "b",
        active: false,
        room_name: "rb",
        display_name: "Léa",
        handle: null,
        avatar_url: null,
      },
    ],
    participants: [
      {
        battle_id: "b1",
        seller_id: "seller-a",
        display_name: "Aïcha",
        side: "a",
        score_amount_live: scores.a,
        score_amount_confirmed: 0,
        score_items: scores.a > 0 ? 2 : 0,
        last_seen_at: "",
        left_at: null,
      },
      {
        battle_id: "b1",
        seller_id: "seller-b",
        display_name: "Léa",
        side: "b",
        score_amount_live: scores.b,
        score_amount_confirmed: 0,
        score_items: scores.b > 0 ? 1 : 0,
        last_seen_at: "",
        left_at: null,
      },
    ],
  };
}

function run() {
  assert.equal(isLeaveReason("forfeit"), true);
  assert.equal(isLeaveReason("timeout"), false);
  assert.equal(fighterHasSales({ sellerId: "x", displayName: "X", scoreAmountLive: 0, scoreItems: 0, liveId: null, avatarUrl: null }), false);

  const scored = battleResultView(battle(), "seller-a");
  assert.equal(scored.winner?.sellerId, "seller-a");
  assert.equal(scored.youWon, true);
  assert.equal(scored.abandon, false);
  assert.equal(scored.showRematch, true);

  const leaverWinsOnScore = battleResultView(
    battle({ end_reason: "disconnected", live_winner_seller_id: "seller-a" }, { a: 25, b: 0 }),
    "seller-a",
  );
  assert.equal(leaverWinsOnScore.abandon, false, "remaining seller already sold → scored win");
  assert.equal(leaverWinsOnScore.showRematch, false);

  const abandon = battleResultView(
    battle({ end_reason: "forfeit", live_winner_seller_id: "seller-a" }, { a: 0, b: 0 }),
    "seller-a",
  );
  assert.equal(abandon.abandon, true);
  assert.equal(abandon.youWon, true);
  assert.equal(abandon.leftName, "Léa");
  assert.equal(abandon.showRematch, false);

  const tie = battleResultView(battle({ live_winner_seller_id: null, end_reason: "timeout" }, { a: 10, b: 10 }));
  assert.equal(tie.tie, true);
  assert.equal(tie.winner, null);
  console.log("battle-result: all checks passed");
}

run();
