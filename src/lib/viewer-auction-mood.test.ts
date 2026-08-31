import assert from "node:assert/strict";
import {
  shouldFlashOutbid,
  viewerAuctionMood,
  viewerAuctionUrgent,
} from "./viewer-auction-mood.ts";

function run() {
  assert.equal(
    viewerAuctionMood({
      auctionLive: true,
      ended: false,
      isHighest: false,
      participated: false,
      viewerId: "me",
      winnerId: null,
    }),
    "normal",
  );
  assert.equal(
    viewerAuctionMood({
      auctionLive: true,
      ended: false,
      isHighest: true,
      participated: true,
      viewerId: "me",
      winnerId: null,
    }),
    "leading",
  );
  assert.equal(
    viewerAuctionMood({
      auctionLive: true,
      ended: false,
      isHighest: false,
      participated: true,
      viewerId: "me",
      winnerId: null,
    }),
    "outbid",
  );
  assert.equal(
    viewerAuctionMood({
      auctionLive: false,
      ended: true,
      isHighest: false,
      participated: true,
      viewerId: "me",
      winnerId: "me",
    }),
    "won",
  );
  assert.equal(
    viewerAuctionMood({
      auctionLive: false,
      ended: true,
      isHighest: false,
      participated: true,
      viewerId: "me",
      winnerId: "other",
    }),
    "lost",
  );

  assert.equal(shouldFlashOutbid(true, false, true), true);
  assert.equal(shouldFlashOutbid(false, false, true), false);
  assert.equal(shouldFlashOutbid(true, true, true), false);
  assert.equal(shouldFlashOutbid(true, false, false), false, "ended sale must not flash");

  assert.equal(viewerAuctionUrgent(22), false);
  assert.equal(viewerAuctionUrgent(5), true);
  assert.equal(viewerAuctionUrgent(1), true);
  assert.equal(viewerAuctionUrgent(0), false);

  console.log("viewer-auction-mood: all checks passed");
}

run();
