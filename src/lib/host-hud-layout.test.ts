import assert from "node:assert/strict";
import {
  HOST_PORTRAIT_CARD_WIDTH,
  hostAuctionGutter,
  hostAuctionTopExtra,
  hostFeaturedRight,
  hostRailBottom,
} from "./host-hud-layout.ts";

function run() {
  assert.ok(HOST_PORTRAIT_CARD_WIDTH < 140, "portrait card must stay compact");
  assert.equal(hostFeaturedRight(), 10);
  assert.equal(hostRailBottom(34), 98);
  assert.ok(hostRailBottom(34) > 34);

  const port = hostAuctionGutter({ layout: "portrait", icon: 44, portraitCardWidth: 122 });
  assert.ok(port.right >= 122, "pills must clear the portrait card");
  const land = hostAuctionGutter({ layout: "landscape", icon: 44 });
  assert.equal(land.right, 58);
  assert.ok(land.right < port.right);

  const landTop = hostAuctionTopExtra({ layout: "landscape", featuredTopExtra: 96, compact: false });
  const portTop = hostAuctionTopExtra({ layout: "portrait", featuredTopExtra: 96, compact: false });
  assert.ok(landTop > portTop, "landscape countdown sits under the wide card");

  console.log("host-hud-layout: all checks passed");
}

run();
