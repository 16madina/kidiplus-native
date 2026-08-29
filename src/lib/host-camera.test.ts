import assert from "node:assert/strict";
import { facingModeOf } from "./host-camera.ts";

function run() {
  assert.equal(facingModeOf("front"), "user");
  assert.equal(facingModeOf("user"), "user");
  assert.equal(facingModeOf("back"), "environment");
  assert.equal(facingModeOf("environment"), "environment");
  assert.equal(facingModeOf(undefined), "user");
  console.log("host-camera: all checks passed");
}

run();
