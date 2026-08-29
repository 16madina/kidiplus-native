import assert from "node:assert/strict";
import {
  HOST_ABSENT_EXPIRE_MINUTES,
  isAbandonedLive,
  minutesUntilHostExpire,
} from "./host-absent.ts";

function run() {
  const started = "2026-08-28T10:00:00.000Z";
  const now = Date.parse("2026-08-28T10:03:00.000Z");

  assert.equal(HOST_ABSENT_EXPIRE_MINUTES, 5);
  assert.equal(minutesUntilHostExpire(started, started, now), 2);
  assert.equal(minutesUntilHostExpire("2026-08-28T10:02:30.000Z", started, now), 5);
  assert.equal(minutesUntilHostExpire(started, started, Date.parse("2026-08-28T10:04:50.000Z")), 1);

  assert.equal(isAbandonedLive({ host_last_seen_at: started, started_at: started }, 5, now), false);
  assert.equal(
    isAbandonedLive(
      { host_last_seen_at: started, started_at: started },
      5,
      Date.parse("2026-08-28T10:05:01.000Z"),
    ),
    true,
  );
  assert.equal(
    isAbandonedLive(
      { host_last_seen_at: null, started_at: started },
      5,
      Date.parse("2026-08-28T10:05:01.000Z"),
    ),
    true,
  );
}

run();
console.log("host-absent.test.ts ok");
