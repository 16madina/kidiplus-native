import assert from "node:assert/strict";
import {
  formatProductMetaLine,
  formatVariantSuffix,
  itemNameWithVariant,
  normalizeCondition,
  parseStringArray,
  togglePreset,
  variantSelectionState,
} from "./live-product-options.ts";

async function run() {
  assert.deepEqual(parseStringArray([" Noir ", "", "M"]), ["Noir", "M"]);
  assert.deepEqual(parseStringArray("Noir"), []);
  assert.equal(normalizeCondition("like_new"), "like_new");
  assert.equal(normalizeCondition("broken"), null);

  const one = variantSelectionState(["Noir"], ["M"]);
  assert.equal(one.needsPick, false);
  assert.equal(one.color, "Noir");
  assert.equal(one.size, "M");

  const many = variantSelectionState(["Noir", "Blanc"], ["S", "M"]);
  assert.equal(many.needsPick, true);
  assert.equal(many.hasOptions, true);
  assert.equal(many.color, undefined);

  assert.equal(formatVariantSuffix("Noir", "M"), " (Noir · M)");
  assert.equal(itemNameWithVariant("Robe", "Rouge", null), "Robe (Rouge)");
  assert.equal(
    formatProductMetaLine({ brand: "Nike", colors: ["Noir", "Blanc"], sizes: ["42"] }),
    "Nike · Noir/Blanc · 42",
  );

  assert.deepEqual(togglePreset(["Noir"], "Blanc"), ["Noir", "Blanc"]);
  assert.deepEqual(togglePreset(["Noir", "Blanc"], "Noir"), ["Blanc"]);
}

void run();
