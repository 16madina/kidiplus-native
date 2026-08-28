import assert from "node:assert/strict";
import {
  bidStepFor,
  maxBidAmount,
  nextBidAmount,
  parseBidAmount,
} from "./money.ts";

function run() {
  assert.equal(bidStepFor(150, "EUR"), 1);
  assert.equal(bidStepFor(5, "EUR"), 0.5);
  assert.equal(nextBidAmount(150, "EUR"), 151);
  assert.equal(nextBidAmount(151, "EUR"), 152);

  assert.equal(parseBidAmount("250", "EUR"), 250);
  assert.equal(parseBidAmount("250,50", "EUR"), 250.5);
  assert.equal(parseBidAmount("250.00", "EUR"), 250);
  assert.equal(parseBidAmount("abc", "EUR"), null);

  assert.ok(maxBidAmount(150, "EUR") >= 2000);
  assert.equal(maxBidAmount(150, "EUR"), 15000);
}

run();
console.log("money-bid.test.ts ok");
