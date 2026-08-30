import assert from "node:assert/strict";
import { applyAffichePan, applyAffichePinch, AFFICHE_BOX_MIN } from "./affiche-layer-gesture.ts";

function run() {
  const origin = { originX: 0.5, originY: 0.4, originScale: 1 };
  const stuck = applyAffichePan({
    ...origin,
    translationX: 40,
    translationY: 40,
    boxW: 1,
    boxH: 1,
  });
  assert.equal(stuck.x, 0.5);
  assert.equal(stuck.y, 0.4);
  assert.ok(AFFICHE_BOX_MIN >= 64);

  const moved = applyAffichePan({
    ...origin,
    translationX: 39,
    translationY: 84.4,
    boxW: 390,
    boxH: 844,
  });
  assert.ok(Math.abs(moved.x - 0.6) < 1e-9);
  assert.ok(Math.abs(moved.y - 0.5) < 1e-9);
  assert.equal(applyAffichePinch(1, 2), 2);
  assert.equal(applyAffichePinch(1, 0), 1);
  console.log("affiche-layer-gesture: all checks passed");
}

run();
