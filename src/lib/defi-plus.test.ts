import assert from "node:assert/strict";
import {
  DEFI_PLUS_DURATION_MS,
  defiPlusElapsedMs,
  defiPlusRemaining,
  isDefiPlusIntroActive,
} from "./defi-plus.ts";

function run() {
  assert.equal(DEFI_PLUS_DURATION_MS, 15_000);
  assert.equal(defiPlusRemaining(0), 10);
  assert.equal(defiPlusRemaining(9_999), 1);
  assert.equal(defiPlusRemaining(10_000), 0);
  assert.equal(defiPlusElapsedMs(1_000, 4_000), 3_000);
  assert.equal(isDefiPlusIntroActive(Date.now() - 1_000), true);
  assert.equal(isDefiPlusIntroActive(Date.now() - 16_000), false);
  console.log("defi-plus: all checks passed");
}

run();
