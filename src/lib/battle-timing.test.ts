import assert from "node:assert/strict";
import {
  battleCountdownMs,
  battleDockMetrics,
  battleFighters,
  battleRemainingMs,
  formatBattleClock,
} from "./battle-timing.ts";
import type { BattleSessionRow, HydratedBattle } from "./battles.ts";

function session(over: Partial<BattleSessionRow> = {}): BattleSessionRow {
  return {
    id: "b1",
    status: "running",
    duration_sec: 900,
    started_at: new Date(1_000_000).toISOString(),
    ends_at: new Date(1_000_000 + 915_000).toISOString(),
    ended_at: null,
    currency: "CAD",
    live_winner_seller_id: null,
    winner_seller_id: null,
    end_reason: null,
    sudden_death: false,
    rematch_of_battle_id: null,
    turn_side: null,
    turn_until: null,
    last_sale_text: null,
    last_sale_at: null,
    sudden_death_at: null,
    ...over,
  };
}

function run() {
  assert.equal(formatBattleClock(900_000), "15:00");
  assert.equal(formatBattleClock(5_000), "00:05");
  const dock = battleDockMetrics(47, 844);
  assert.equal(dock.dockTop, 171);
  assert.equal(dock.dockHeight, 300);
  assert.equal(dock.cardTop, 477);
  assert.equal(dock.hudTop, 95);
  const now = 1_000_000 + 3_000;
  assert.ok(battleCountdownMs(session(), now) > 0);
  assert.equal(battleRemainingMs(session(), now), 900_000, "clock frozen during intro");
  const afterIntro = 1_000_000 + 16_000;
  assert.equal(battleCountdownMs(session(), afterIntro), 0);
  assert.ok(battleRemainingMs(session(), afterIntro) < 900_000);

  const battle = {
    session: session(),
    lives: [
      {
        battle_id: "b1",
        live_id: "mine",
        seller_id: "a",
        side: "a",
        active: true,
        room_name: "r1",
        display_name: "Aïcha",
        handle: null,
        avatar_url: null,
      },
      {
        battle_id: "b1",
        live_id: "theirs",
        seller_id: "b",
        side: "b",
        active: true,
        room_name: "r2",
        display_name: "Léa",
        handle: null,
        avatar_url: null,
      },
    ],
    participants: [
      {
        battle_id: "b1",
        seller_id: "a",
        display_name: "Aïcha",
        side: "a",
        score_amount_live: 10,
        score_amount_confirmed: 0,
        score_items: 1,
        last_seen_at: "",
        left_at: null,
      },
      {
        battle_id: "b1",
        seller_id: "b",
        display_name: "Léa",
        side: "b",
        score_amount_live: 40,
        score_amount_confirmed: 0,
        score_items: 2,
        last_seen_at: "",
        left_at: null,
      },
    ],
  } as HydratedBattle;
  const sides = battleFighters(battle, "theirs");
  assert.equal(sides.left.displayName, "Léa", "anchor live is left");
  assert.equal(sides.right.displayName, "Aïcha");
  console.log("battle-timing: all checks passed");
}

run();
