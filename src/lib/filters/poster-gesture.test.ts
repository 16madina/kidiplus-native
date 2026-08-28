import assert from "node:assert/strict";
import { applyPosterPan, applyPosterPinch, POSTER_BOX_MIN } from "./poster-gesture";

function run() {
  const origin = { originX: 0.5, originY: 0.4, originScale: 1 };

  // Tap / tiny move on an unmeasured 1×1 box must NOT fling the poster to a corner.
  const jumped = applyPosterPan({
    ...origin,
    translationX: -20,
    translationY: -80,
    boxW: 1,
    boxH: 1,
  });
  assert.equal(jumped.x, 0.5, "unmeasured box must not change x");
  assert.equal(jumped.y, 0.4, "unmeasured box must not change y");
  assert.ok(POSTER_BOX_MIN >= 64);

  // Zero translation (finger down, no move) stays put.
  const tap = applyPosterPan({
    ...origin,
    translationX: 0,
    translationY: 0,
    boxW: 390,
    boxH: 844,
  });
  assert.equal(tap.x, 0.5);
  assert.equal(tap.y, 0.4);

  // One-finger drag follows the finger: +39px on a 390px-wide preview = +0.1
  const dragged = applyPosterPan({
    ...origin,
    translationX: 39,
    translationY: 84.4,
    boxW: 390,
    boxH: 844,
  });
  assert.ok(Math.abs(dragged.x - 0.6) < 1e-9, `x ${dragged.x}`);
  assert.ok(Math.abs(dragged.y - 0.5) < 1e-9, `y ${dragged.y}`);
  assert.equal(dragged.scale, 1);

  // Two-finger pinch: scale 2 keeps the image under the fingers, bigger.
  assert.equal(applyPosterPinch(1, 2), 2);
  assert.equal(applyPosterPinch(1, 0.5), 0.5);
  // Degenerate pinch (iOS sometimes sends 0) must not shrink to min.
  assert.equal(applyPosterPinch(1, 0), 1);

  console.log("poster-gesture: all checks passed");
}

run();
