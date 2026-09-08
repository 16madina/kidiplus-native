import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function run() {
  const sync = readFileSync(new URL("./lives-feed-sync.ts", import.meta.url), "utf8");
  assert.match(sync, /postgres_changes/);
  assert.match(sync, /table: "lives"/);
  assert.match(sync, /subscribeHostLiveStarted/);
  assert.match(sync, /subscribeHostLiveEnded/);
  assert.match(sync, /POLL_MS = 8_000/);
  assert.match(sync, /dropEndedLive/);
  assert.match(sync, /if \(AppState\.currentState === "active"\) void reloadLivesFeed\(\)/);

  const hook = readFileSync(new URL("../hooks/useLivesFeed.ts", import.meta.url), "utf8");
  assert.match(hook, /subscribeLivesFeed/);
  assert.match(hook, /reloadLivesFeed\(\{ housekeep: true \}\)/);

  const lives = readFileSync(new URL("./lives.ts", import.meta.url), "utf8");
  assert.match(lives, /notifyHostLiveStarted/);
  assert.match(lives, /notifyHostLiveEnded\(liveId\)/);
  assert.match(lives, /opts\?\.housekeep/);

  const bus = readFileSync(new URL("./host-open-live.ts", import.meta.url), "utf8");
  assert.match(bus, /export function notifyHostLiveStarted/);
  assert.match(bus, /export function subscribeHostLiveStarted/);

  console.log("lives-feed-sync.test.ts ok");
}

run();
