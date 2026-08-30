import assert from "node:assert/strict";
import { liveFxChannelName } from "./live-fx.ts";

function run() {
  assert.equal(liveFxChannelName("abc"), "live-fx:abc");
  console.log("live-fx-broadcast: all checks passed");
}

run();
