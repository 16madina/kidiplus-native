import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function run() {
  const shop = readFileSync(new URL("./ShopScreen.tsx", import.meta.url), "utf8");
  assert.match(shop, /sellerReplayKind/);
  assert.match(shop, /sellerLiveStillListed/);
  assert.match(shop, /fetchLiveReplayMeta/);
  assert.match(shop, /saveLiveReplayToDevice/);
  assert.match(shop, /shareReplay/);
  assert.match(shop, /styles\.liveCardHit/);
  assert.doesNotMatch(shop, /shopTab === "replays"/);

  const replay = readFileSync(new URL("../lib/live-replay.ts", import.meta.url), "utf8");
  assert.match(replay, /const signed = await resolvePlayableReplayUrl/);

  console.log("shop-replays.test.ts ok");
}

run();
