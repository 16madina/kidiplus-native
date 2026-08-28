import assert from "node:assert/strict";
import { formatAuctionSeconds } from "./auction-now-bar.ts";

function run() {
  assert.equal(formatAuctionSeconds(19), "19s");
  assert.equal(formatAuctionSeconds(1), "1s");
  assert.equal(formatAuctionSeconds(0), "0s");
  assert.equal(formatAuctionSeconds(-4), "0s");
  assert.equal(formatAuctionSeconds(60), "1:00");
  assert.equal(formatAuctionSeconds(75), "1:15");
  assert.equal(formatAuctionSeconds(19.9), "19s");
}

run();
console.log("auction-now-bar.test.ts ok");
