import assert from "node:assert/strict";
import { liveSafeBottom } from "./live-safe-bottom.ts";

function run() {
  assert.equal(liveSafeBottom(34), 42);
  assert.equal(liveSafeBottom(0), 28);
  assert.equal(liveSafeBottom(10), 28);
  assert.equal(liveSafeBottom(34, 10), 44);
  console.log("layout-safe: all checks passed");
}

run();
