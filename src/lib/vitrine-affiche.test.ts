import assert from "node:assert/strict";
import {
  encodeAfficheCaption,
  newAfficheLayout,
  parseAfficheCaption,
} from "./vitrine-affiche-logic.ts";

function run() {
  const layout = newAfficheLayout({ sellerName: "Inès Or", shopName: "@inesor", title: "Chaînes" });
  assert.equal(layout.kidiAffiche, true);
  assert.equal(layout.sellerName, "Inès Or");
  assert.equal(layout.shopName, "@inesor");
  assert.equal(layout.title, "Chaînes");
  assert.equal(layout.remindFollowers, true);
  assert.equal(layout.layers.length, 0);

  const encoded = encodeAfficheCaption({ ...layout, title: "Soldes", badge: "Bientôt" });
  const parsed = parseAfficheCaption(encoded);
  assert.ok(parsed);
  assert.equal(parsed?.title, "Soldes");
  assert.equal(parsed?.badge, "Bientôt");
  assert.equal(parsed?.sellerName, "Inès Or");
  assert.ok(parsed?.eventAt);
  const legacy = parseAfficheCaption(JSON.stringify({ kidiAffiche: true, title: "Old", layers: [] }));
  assert.ok(legacy);
  assert.equal(legacy?.sellerName, "");
  assert.equal(legacy?.badge, "");
  assert.equal(parseAfficheCaption("hello"), null);
  assert.equal(parseAfficheCaption(null), null);
}

run();
console.log("vitrine-affiche.test.ts ok");
