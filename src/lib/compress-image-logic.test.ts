import assert from "node:assert/strict";
import { fitWithin, isPngMime } from "./compress-image-logic.ts";

assert.equal(fitWithin(1200, 800), null);
assert.equal(fitWithin(1600, 1600), null);
assert.deepEqual(fitWithin(4032, 3024), { width: 1600, height: 1200 });
assert.deepEqual(fitWithin(3024, 4032), { width: 1200, height: 1600 });
assert.deepEqual(fitWithin(8000, 10, 1600), { width: 1600, height: 2 });
assert.equal(fitWithin(0, 4032), null);
assert.equal(fitWithin(null, undefined), null);

assert.equal(isPngMime("image/png"), true);
assert.equal(isPngMime("image/PNG"), true);
assert.equal(isPngMime("image/jpeg"), false);
assert.equal(isPngMime(null), false);

console.log("compress-image-logic.test.ts: ok");
