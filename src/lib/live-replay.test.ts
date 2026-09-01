import assert from "node:assert/strict";
import {
  replayDaysLeft,
  replayDownloadFilename,
  sellerLiveStillListed,
  sellerReplayKind,
} from "./live-replay-meta.ts";

function run() {
  const now = Date.parse("2026-08-31T12:00:00.000Z");
  assert.equal(replayDaysLeft(new Date(now + 3 * 24 * 60 * 60 * 1000 + 1000).toISOString(), now), 4);
  assert.equal(replayDaysLeft(new Date(now + 12 * 60 * 60 * 1000).toISOString(), now), 1);
  assert.equal(replayDaysLeft(new Date(now - 1000).toISOString(), now), 0);
  assert.equal(replayDaysLeft(null, now), null);
  assert.equal(replayDaysLeft(undefined, now), null);

  const stamp = new Date("2026-08-31T12:00:00.000Z");
  assert.equal(replayDownloadFilename("Perruque 💎 Live", stamp), "kidiplus-perruque-live-2026-08-31.mp4");
  assert.equal(replayDownloadFilename("   ", stamp), "kidiplus-live-2026-08-31.mp4");

  assert.equal(sellerReplayKind({ status: "live" }, now), "live");
  assert.equal(sellerReplayKind({ status: "scheduled" }, now), "scheduled");
  assert.equal(
    sellerReplayKind(
      { status: "ended", replay_status: "ready", replay_expires_at: new Date(now + 86_400_000).toISOString() },
      now,
    ),
    "ready",
  );
  assert.equal(sellerReplayKind({ status: "ended", replay_status: "processing" }, now), "pending");
  assert.equal(
    sellerReplayKind(
      { status: "ended", replay_status: "ready", replay_expires_at: new Date(now - 1000).toISOString() },
      now,
    ),
    "expired",
  );

  assert.equal(sellerLiveStillListed({ status: "live" }, now), true);
  assert.equal(
    sellerLiveStillListed({ status: "ended", ended_at: new Date(now - 2 * 86_400_000).toISOString() }, now),
    true,
  );
  assert.equal(
    sellerLiveStillListed({ status: "ended", ended_at: new Date(now - 8 * 86_400_000).toISOString() }, now),
    false,
  );
  assert.equal(
    sellerLiveStillListed(
      {
        status: "ended",
        ended_at: new Date(now - 8 * 86_400_000).toISOString(),
        replay_status: "ready",
        replay_expires_at: new Date(now + 86_400_000).toISOString(),
      },
      now,
    ),
    true,
  );

  console.log("live-replay-meta: all checks passed");
}

run();
