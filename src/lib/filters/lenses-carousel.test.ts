import assert from "node:assert/strict";
import { composeCarouselLenses } from "./lenses-carousel.ts";

function run() {
  const none = { lensId: "none", name: "Aucun" };
  const snap = [
    { lensId: "a", name: "Snap A" },
    { lensId: "b", name: "Snap B" },
  ];
  const styles = [
    { lensId: "none", name: "Aucun" },
    { lensId: "glow", name: "Glow" },
  ];
  const list = composeCarouselLenses(none, snap, styles);
  assert.deepEqual(
    list.map((l) => l.lensId),
    ["none", "a", "b", "glow"],
  );
  assert.equal(composeCarouselLenses(none, [], styles).map((l) => l.lensId).join(","), "none,glow");
  console.log("lenses-carousel: all checks passed");
}

run();
