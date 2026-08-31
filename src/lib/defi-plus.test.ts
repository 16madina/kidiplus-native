import assert from "node:assert/strict";
import {
  DEFI_PLUS_DURATION_MS,
  defiPlusElapsedMs,
  defiPlusRemaining,
  isDefiPlusIntroActive,
  resolveDefiPlusIntroStart,
} from "./defi-plus.ts";

function run() {
  assert.equal(DEFI_PLUS_DURATION_MS, 18_000);
  assert.equal(defiPlusRemaining(0), 10);
  assert.equal(defiPlusRemaining(9_999), 1);
  assert.equal(defiPlusRemaining(10_000), 0);
  assert.equal(defiPlusElapsedMs(1_000, 4_000), 3_000);
  assert.equal(isDefiPlusIntroActive(Date.now() - 1_000), true);
  assert.equal(isDefiPlusIntroActive(Date.now() - 16_000), true);
  assert.equal(isDefiPlusIntroActive(Date.now() - 19_000), false);
  assert.equal(resolveDefiPlusIntroStart("2026-08-31T00:00:00.000Z", 99), Date.parse("2026-08-31T00:00:00.000Z"));
  assert.equal(resolveDefiPlusIntroStart(null, 42), 42);
  assert.equal(resolveDefiPlusIntroStart(undefined, null), null);
  console.log("defi-plus: all checks passed");
}

run();
