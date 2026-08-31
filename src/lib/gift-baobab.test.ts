import assert from "node:assert/strict";
import {
  BAOBAB_DURATION_MS,
  BAOBAB_GROW_S,
  baobabProgress,
  isBaobabGiftKey,
} from "./gift-baobab.ts";

async function run() {
  assert.ok(BAOBAB_DURATION_MS > 6000);
  assert.equal(isBaobabGiftKey("kidi"), true);
  assert.equal(isBaobabGiftKey("baobab"), true);
  assert.equal(isBaobabGiftKey("rose"), false);

  const start = baobabProgress(0);
  assert.equal(start.grow, 0);
  assert.equal(start.fade, 0);

  const midGrow = baobabProgress((BAOBAB_GROW_S / 2) * 1000);
  assert.ok(midGrow.grow > 0.4 && midGrow.grow < 0.6);

  const grown = baobabProgress(BAOBAB_GROW_S * 1000);
  assert.equal(grown.grow, 1);
  assert.ok(grown.label > 0);

  const done = baobabProgress(BAOBAB_DURATION_MS);
  assert.equal(done.fade, 1);
}

void run();
