import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function run() {
  const shop = readFileSync(new URL("./ShopScreen.tsx", import.meta.url), "utf8");
  assert.match(shop, /openReplayEntry/);
  assert.match(shop, /downloadLiveReplay/);
  assert.match(shop, /sellerLiveStillListed/);
  assert.match(shop, /ReplayPlayerModal/);
  assert.match(shop, /onPress=\{\(\) => void openReplayEntry\(l\)\}/);
  assert.doesNotMatch(shop, /shopTab === "replays"/);

  const modal = readFileSync(new URL("../components/live/ReplayPlayerModal.tsx", import.meta.url), "utf8");
  assert.match(modal, /broadcast\.replay\.download/);
  assert.match(modal, /VideoView/);

  console.log("shop-replays.test.ts ok");
}

run();
