import assert from "node:assert/strict";
import { replayDaysLeft, sellerLiveStillListed, sellerReplayKind } from "./live-replay-meta.ts";

function run() {
  const now = Date.parse("2026-09-11T12:00:00.000Z");
  assert.equal(replayDaysLeft(new Date(now + 3 * 86_400_000).toISOString(), null, now), 3);
  assert.equal(replayDaysLeft(null, new Date(now - 2 * 86_400_000).toISOString(), now), 5);
  assert.equal(replayDaysLeft(new Date(now - 1000).toISOString(), null, now), 0);

  assert.equal(sellerReplayKind({ status: "live" }, now), "live");
  assert.equal(sellerReplayKind({ status: "ended", replay_status: "recording" }, now), "pending");
  assert.equal(sellerReplayKind({ status: "ended", replay_status: null }, now), "pending");
  assert.equal(
    sellerReplayKind(
      {
        status: "ended",
        replay_status: "ready",
        replay_expires_at: new Date(now + 86_400_000).toISOString(),
      },
      now,
    ),
    "ready",
  );
  assert.equal(
    sellerReplayKind({ status: "ended", replay_status: "processing", replay_url: "https://x/a.mp4" }, now),
    "ready",
  );
  assert.equal(
    sellerReplayKind(
      { status: "ended", replay_status: "ready", replay_expires_at: new Date(now - 1000).toISOString() },
      now,
    ),
    "expired",
  );

  assert.equal(sellerLiveStillListed({ status: "live" }, now), true);
  assert.equal(
    sellerLiveStillListed({ status: "ended", ended_at: new Date(now - 8 * 86_400_000).toISOString() }, now),
    false,
  );

  console.log("live-replay-meta: all checks passed");
}

run();
