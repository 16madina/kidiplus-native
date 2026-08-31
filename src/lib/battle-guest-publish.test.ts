import assert from "node:assert/strict";
import {
  BATTLE_GUEST_VIDEO,
  describeMediaTrack,
  pickBattleGuestPublishPath,
  shouldSubscribeBattleHudParticipant,
} from "./battle-guest-publish.ts";

function run() {
  assert.equal(BATTLE_GUEST_VIDEO.width, 960);
  assert.equal(BATTLE_GUEST_VIDEO.height, 540);
  assert.equal(BATTLE_GUEST_VIDEO.frameRate, 24);
  assert.equal(BATTLE_GUEST_VIDEO.maxBitrate, 700_000);

  assert.equal(pickBattleGuestPublishPath({ nativeMethod: true }), "native_kit");
  assert.equal(pickBattleGuestPublishPath({ nativeMethod: true, kitPublishing: true }), "native_kit");
  assert.equal(pickBattleGuestPublishPath({ nativeMethod: true, kitPublishing: false }), "js_audio_only");
  assert.equal(pickBattleGuestPublishPath({ nativeMethod: false }), "js_audio_only");

  const host = "seller-1";
  assert.equal(shouldSubscribeBattleHudParticipant(`battle_${host}`, host), true);
  assert.equal(shouldSubscribeBattleHudParticipant(host, host), false);
  assert.equal(shouldSubscribeBattleHudParticipant(`hud_${host}`, host), false);
  assert.equal(shouldSubscribeBattleHudParticipant("viewer_abc", host), false);

  assert.deepEqual(describeMediaTrack(null), { readyState: "missing", width: 0, height: 0 });
  assert.deepEqual(
    describeMediaTrack({
      readyState: "live",
      getSettings: () => ({ width: 1280, height: 720 }),
    }),
    { readyState: "live", width: 1280, height: 720 },
  );

  console.log("battle-guest-publish: all checks passed");
}

run();
