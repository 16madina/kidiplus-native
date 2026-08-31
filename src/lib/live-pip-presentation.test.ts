import assert from "node:assert/strict";
import {
  LIVE_PIP_MINI,
  livePipMode,
  liveViewerBackAction,
  liveViewerChromeHidden,
  liveViewerChromeHiddenForPip,
} from "./live-pip-presentation.ts";
import {
  ANDROID_PIP_PREPARE_MS,
  VIEWER_ANDROID_AUDIO_PRESET,
  VIEWER_APPLE_PLAYBACK,
  VIEWER_PUBLISH_MIC,
  liveSystemPipOn,
  hostIosPipConfig,
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

  const pipOff = hostIosPipConfig(false);
  assert.equal(pipOff.enabled, false);
  assert.equal(pipOff.startAutomatically, false);
  const pipOn = hostIosPipConfig(true);
  assert.equal(pipOn.enabled, true);
  assert.equal(pipOn.startAutomatically, true);
  assert.equal(pipOn.preferredSize.width, 9);
  assert.equal(pipOn.preferredSize.height, 16);

  assert.equal(VIEWER_PUBLISH_MIC, false);
  assert.equal(VIEWER_ANDROID_AUDIO_PRESET, "media");
  assert.equal(VIEWER_APPLE_PLAYBACK.audioCategory, "playback");
  assert.equal(VIEWER_APPLE_PLAYBACK.audioMode, "moviePlayback");
  assert.ok(ANDROID_PIP_PREPARE_MS >= 120);

  assert.equal(viewerKeepsFullVideoQuality(false, false), false);
  assert.equal(viewerKeepsFullVideoQuality(true, false), true);
  assert.equal(viewerKeepsFullVideoQuality(false, true), true);
  assert.equal(viewerAdaptiveStreamEnabled(true), false);
  assert.equal(viewerAdaptiveStreamEnabled(false), true);
}

run();
console.log("live-pip-presentation.test.ts ok");
