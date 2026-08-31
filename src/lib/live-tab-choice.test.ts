import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIVE_TAB_CHOICE, liveTabChoiceHeight } from "./live-tab-choice.ts";

function run() {
  assert.equal(LIVE_TAB_CHOICE.aspectRatio, 9 / 17);
  assert.equal(LIVE_TAB_CHOICE.minHeight, 280);
  assert.ok(LIVE_TAB_CHOICE.minHeight > 210);

  // iPhone-ish card (~173pt) follows 9:17 — taller than the old 210pt box.
  const phone = liveTabChoiceHeight(173);
  assert.ok(phone > 300);
  assert.equal(phone, 173 / (9 / 17));

  // Narrow card still respects the floor.
  assert.equal(liveTabChoiceHeight(100), 280);

  const src = readFileSync(new URL("../screens/LiveTabScreen.tsx", import.meta.url), "utf8");
  assert.match(src, /LIVE_TAB_CHOICE/);
  assert.doesNotMatch(src, /height:\s*210/);

  console.log("live-tab-choice.test.ts ok");
}

run();
