import assert from "node:assert/strict";
import {
  DEFAULT_HOST_FEATURED_LAYOUT,
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

  console.log("host-featured-layout: all checks passed");
}

run();
