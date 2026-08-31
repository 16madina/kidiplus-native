import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIVE_PIP_MINI,
  livePipMode,
  liveViewerBackAction,
  liveViewerChromeHidden,
  liveViewerChromeHiddenForPip,
  liveEdgeShouldCatch,
  liveEdgeShouldMinimize,
  liveListItemLayout,
} from "./live-pip-presentation.ts";
import {
  ANDROID_PIP_PREPARE_MS,
  VIEWER_ANDROID_AUDIO_PRESET,
  VIEWER_APPLE_PLAYBACK,
  VIEWER_PUBLISH_MIC,
  liveSystemPipOn,
  viewerAdaptiveStreamEnabled,
  viewerKeepsFullVideoQuality,
} from "./live-viewer-media.ts";

function run() {
  assert.equal(LIVE_PIP_MINI.width, 118);
  assert.equal(LIVE_PIP_MINI.height, 210);

  assert.equal(livePipMode("full", false), "full");
  assert.equal(livePipMode("minimized", false), "mini");
  assert.equal(livePipMode("full", true), "system");
  assert.equal(livePipMode("minimized", true), "system");

  assert.equal(liveViewerBackAction("full"), "minimize");
  assert.equal(liveViewerBackAction("minimized"), "close");

  assert.equal(liveViewerChromeHidden("full"), false);
  assert.equal(liveViewerChromeHidden("mini"), true);
  assert.equal(liveViewerChromeHidden("system"), true);

  assert.equal(liveViewerChromeHiddenForPip("full", false), false);
  assert.equal(liveViewerChromeHiddenForPip("full", true), true);
  assert.equal(liveViewerChromeHiddenForPip("minimized", false), true);
  assert.equal(liveViewerChromeHiddenForPip("minimized", true), true);

  assert.equal(liveSystemPipOn(false, false), false);
  assert.equal(liveSystemPipOn(false, true), true);
  assert.equal(liveSystemPipOn(true, false), true);

  assert.equal(VIEWER_PUBLISH_MIC, false);
  assert.equal(VIEWER_ANDROID_AUDIO_PRESET, "media");
  assert.equal(VIEWER_APPLE_PLAYBACK.audioCategory, "playback");
  assert.equal(VIEWER_APPLE_PLAYBACK.audioMode, "moviePlayback");
  assert.equal(VIEWER_APPLE_PLAYBACK.audioCategoryOptions.length, 0);

  assert.equal(liveEdgeShouldCatch(12, 4), true);
  assert.equal(liveEdgeShouldCatch(4, 2), false);
  assert.equal(liveEdgeShouldMinimize(40, 0), true);
  assert.equal(liveEdgeShouldMinimize(10, 0.4), true);
  assert.equal(liveEdgeShouldMinimize(10, 0.1), false);

  assert.deepEqual(liveListItemLayout(false, 2, 2, 800), { length: 800, offset: 1600, index: 2 });
  assert.deepEqual(liveListItemLayout(true, 2, 2, 800), { length: LIVE_PIP_MINI.height, offset: 0, index: 2 });
  assert.deepEqual(liveListItemLayout(true, 0, 2, 800), { length: 0, offset: 0, index: 0 });
  assert.ok(ANDROID_PIP_PREPARE_MS >= 120);

  assert.equal(viewerKeepsFullVideoQuality(false, false), false);
  assert.equal(viewerKeepsFullVideoQuality(true, false), true);
  assert.equal(viewerKeepsFullVideoQuality(false, true), true);
  assert.equal(viewerAdaptiveStreamEnabled(true), false);
  assert.equal(viewerAdaptiveStreamEnabled(false), true);

  const shell = readFileSync(new URL("../components/live/LivePipShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /videoHost/);
  assert.match(shell, /miniClip/);
  assert.match(shell, /overflow: "visible"/);
  assert.doesNotMatch(
    shell,
    /borderRadius: 18,\s*\n\s*zIndex: 55/,
    "mini transform host must not set borderRadius (clipsToBounds)",
  );
  assert.doesNotMatch(
    shell,
    /borderRadius: 18,\s*\n\s*zIndex: 55,\s*\n\s*overflow: "hidden"/,
    "mini transform host must not clip the video",
  );

  const pipHook = readFileSync(new URL("./live-pip.ts", import.meta.url), "utf8");
  assert.match(pipHook, /lastSessionKeyRef/);
  assert.match(pipHook, /displayNameRef/);
  assert.match(pipHook, /\[enabled, pipIdentity, roomName, sessionKey\]/);
  assert.doesNotMatch(pipHook, /\[displayName, enabled/);
}

run();
console.log("live-pip-presentation.test.ts ok");
