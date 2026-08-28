import assert from "node:assert/strict";
import {
  LIVE_PIP_MINI,
  livePipMode,
  liveViewerBackAction,
  liveViewerChromeHidden,
} from "./live-pip-presentation.ts";

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
}

run();
console.log("live-pip-presentation.test.ts ok");
