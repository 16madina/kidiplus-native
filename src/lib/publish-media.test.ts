import assert from "node:assert/strict";
import {
  clampCoverTransform,
  clampTrimRange,
  cropRectFromCoverTransform,
  displayVitrineCaption,
  encodeStoryPosterClip,
  encodeVideoClipCaption,
  formatClock,
  initialTrimWindow,
  isVideoMediaUrl,
  maxVideoSecForMode,
  moveTrimWindow,
  parseStoryPosterClip,
  parseVideoClipCaption,
  pickerDurationToSec,
  resizeTrimEnd,
  resizeTrimStart,
  shouldPersistClip,
  videoNeedsForcedTrim,
} from "./publish-media.ts";

function run() {
  assert.equal(maxVideoSecForMode("video"), 60);
  assert.equal(maxVideoSecForMode("story"), 15);
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(7.2), "0:07");
  assert.equal(formatClock(65), "1:05");
  assert.equal(pickerDurationToSec(15000), 15);
  assert.equal(pickerDurationToSec(0), null);

  const win = { imageW: 1080, imageH: 1920, viewW: 360, viewH: 640 };
  const fit = clampCoverTransform({ ...win, scale: 1, translateX: 0, translateY: 0 });
  assert.equal(fit.scale, 1);
  assert.equal(fit.translateX, 0);
  assert.equal(fit.translateY, 0);

  const zoomed = clampCoverTransform({ ...win, scale: 2, translateX: 400, translateY: 800 });
  assert.equal(zoomed.scale, 2);
  assert.ok(zoomed.translateX < 400);
  assert.ok(Math.abs(zoomed.translateX) <= (1080 * (1 / 3) * 2 - 360) / 2 + 1e-6);

  const crop = cropRectFromCoverTransform({ ...win, scale: 1, translateX: 0, translateY: 0 });
  assert.ok(Math.abs(crop.width - 1080) < 1.5);
  assert.ok(Math.abs(crop.height - 1920) < 1.5);
  assert.ok(crop.originX >= 0 && crop.originY >= 0);

  const wide = cropRectFromCoverTransform({
    imageW: 2000,
    imageH: 1000,
    viewW: 360,
    viewH: 640,
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  assert.ok(wide.height <= 1000 + 1e-6);
  assert.ok(wide.width < 2000);
  assert.ok(wide.originX > 0);

  assert.deepEqual(initialTrimWindow(90, 60), { startSec: 0, endSec: 60 });
  assert.deepEqual(initialTrimWindow(12, 60), { startSec: 0, endSec: 12 });

  const forced = clampTrimRange(90, 10, 80, 60);
  assert.ok(forced.endSec - forced.startSec <= 60 + 1e-6);
  assert.ok(forced.endSec <= 90);

  const moved = moveTrimWindow(90, 0, 60, 20, 60);
  assert.equal(moved.startSec, 20);
  assert.equal(moved.endSec, 80);

  const overflow = moveTrimWindow(90, 0, 60, 80, 60);
  assert.equal(overflow.startSec, 30);
  assert.equal(overflow.endSec, 90);

  const startFixed = resizeTrimStart(90, 0, 60, 12, 60);
  assert.equal(startFixed.startSec, 12);
  assert.equal(startFixed.endSec, 72);

  const endFree = resizeTrimEnd(40, 0, 40, 20, 60);
  assert.equal(endFree.startSec, 0);
  assert.equal(endFree.endSec, 20);

  assert.equal(videoNeedsForcedTrim(61, 60), true);
  assert.equal(videoNeedsForcedTrim(59, 60), false);
  assert.equal(shouldPersistClip({ startSec: 0, endSec: 40 }, 40), false);
  assert.equal(shouldPersistClip({ startSec: 3, endSec: 40 }, 40), true);

  const encoded = encodeVideoClipCaption("Hello", { startSec: 2.5, endSec: 62.5 }, 90);
  const parsed = parseVideoClipCaption(encoded);
  assert.equal(parsed.text, "Hello");
  assert.ok(parsed.clip);
  assert.equal(parsed.clip?.startSec, 2.5);
  assert.equal(parsed.clip?.endSec, 62.5);
  assert.equal(displayVitrineCaption(encoded), "Hello");
  assert.equal(parseVideoClipCaption("juste une légende").text, "juste une légende");
  assert.equal(encodeVideoClipCaption("ok", { startSec: 0, endSec: 12 }, 12), "ok");

  const story = encodeStoryPosterClip(null, { startSec: 1, endSec: 16 });
  const storyParsed = parseStoryPosterClip(story);
  assert.equal(storyParsed.clip?.startSec, 1);
  assert.equal(storyParsed.clip?.endSec, 16);
  assert.equal(storyParsed.posterUrl, null);
  const withPoster = parseStoryPosterClip(encodeStoryPosterClip("https://x/p.jpg", { startSec: 0, endSec: 15 }));
  assert.equal(withPoster.posterUrl, "https://x/p.jpg");
  assert.equal(parseStoryPosterClip("https://x/p.jpg").posterUrl, "https://x/p.jpg");

  assert.equal(isVideoMediaUrl("https://x/a.mp4#kidiClip=0-15"), true);
  assert.equal(isVideoMediaUrl("https://x/a.jpg"), false);
}

run();
console.log("publish-media.test.ts ok");
