import assert from "node:assert/strict";
import {
  encodeAfficheCaption,
  newAfficheLayout,
  parseAfficheCaption,
} from "./vitrine-affiche-logic.ts";

function run() {
  const layout = newAfficheLayout();
  assert.equal(layout.kidiAffiche, true);
  assert.ok(layout.layers.some((l) => l.kind === "text"));

  const encoded = encodeAfficheCaption({ ...layout, title: "Soldes" });
  const parsed = parseAfficheCaption(encoded);
  assert.ok(parsed);
  assert.equal(parsed?.title, "Soldes");
  assert.ok(parsed?.eventAt);
  assert.equal(parseAfficheCaption("hello"), null);
  assert.equal(parseAfficheCaption(null), null);
}

run();
console.log("vitrine-affiche.test.ts ok");
