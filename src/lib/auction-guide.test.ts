import assert from "node:assert/strict";
import { AUCTION_GUIDE_STEPS, auctionGuideCopy } from "./auction-guide.ts";

async function run() {
  assert.equal(AUCTION_GUIDE_STEPS.length, 6);
  const first = AUCTION_GUIDE_STEPS[0]!;
  assert.equal(auctionGuideCopy(first, "fr").title, first.titleFr);
  assert.equal(auctionGuideCopy(first, "en").title, first.titleEn);
  assert.match(auctionGuideCopy(AUCTION_GUIDE_STEPS[3]!, "fr").body, /bouton or/i);
}

void run();
