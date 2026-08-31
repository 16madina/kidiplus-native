import assert from "node:assert/strict";
import {
  DEFAULT_HOST_FEATURED_LAYOUT,
  featuredPriceLine,
  hostFeaturedCtaKind,
  parseHostFeaturedLayout,
  toggleHostFeaturedLayout,
} from "./host-featured-layout.ts";

function run() {
  assert.equal(DEFAULT_HOST_FEATURED_LAYOUT, "portrait");
  assert.equal(parseHostFeaturedLayout("landscape"), "landscape");
  assert.equal(parseHostFeaturedLayout("portrait"), "portrait");
  assert.equal(parseHostFeaturedLayout("nope"), "portrait");
  assert.equal(parseHostFeaturedLayout(null), "portrait");
  assert.equal(toggleHostFeaturedLayout("portrait"), "landscape");
  assert.equal(toggleHostFeaturedLayout("landscape"), "portrait");

  assert.equal(hostFeaturedCtaKind({ mode: "auction", status: "idle", auctionLive: false }), "start");
  assert.equal(hostFeaturedCtaKind({ mode: "auction", status: "idle", auctionLive: true }), "timer");
  assert.equal(hostFeaturedCtaKind({ mode: "auction", status: "sold", auctionLive: false }), "replay");
  assert.equal(hostFeaturedCtaKind({ mode: "fixed", status: "idle", auctionLive: false }), "list");
  assert.equal(hostFeaturedCtaKind({ mode: "fixed", status: "active", auctionLive: false }), "listed");

  const liveSale = { mode: "auction" as const, status: "active", auctionLive: true };
  assert.equal(hostFeaturedCtaKind(liveSale), "timer");
  assert.equal(
    featuredPriceLine({
      auctionLive: true,
      mode: "auction",
      layout: "portrait",
      priceLabel: "1 200 $",
      startLabel: "Départ : 1 000 $",
    }),
    "1 200 $",
  );
  assert.equal(
    featuredPriceLine({
      auctionLive: true,
      mode: "auction",
      layout: "landscape",
      priceLabel: "1 200 $",
      startLabel: "Départ : 1 000 $",
    }),
    "1 200 $",
    "layout switch must keep the current price, not the start price",
  );
  assert.equal(
    featuredPriceLine({
      auctionLive: false,
      mode: "auction",
      layout: "landscape",
      priceLabel: "1 000 $",
      startLabel: "Départ : 1 000 $",
    }),
    "Départ : 1 000 $",
  );

  console.log("host-featured-layout: all checks passed");
}

run();
