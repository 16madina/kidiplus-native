import assert from "node:assert/strict";
import {
  decodeLiveFx,
  EMPTY_LIVE_FX,
  encodeLiveFx,
  isLocalImageUri,
  isPublishableImageUrl,
  liveFxEquals,
  liveFxHasVisual,
  liveTintForLens,
  sanitizeLiveFx,
} from "./live-fx.ts";

function run() {
  assert.equal(isLocalImageUri("file:///tmp/poster.jpg"), true);
  assert.equal(isLocalImageUri("https://cdn.example/p.jpg"), false);
  assert.equal(isPublishableImageUrl("https://cdn.example/p.jpg"), true);
  assert.equal(isPublishableImageUrl("file:///tmp/p.jpg"), false);

  assert.equal(liveTintForLens({ lensId: "none" }), "transparent");
  assert.equal(liveTintForLens({ lensId: "style-warm", tint: "rgba(255,140,60,0.24)" }), "rgba(255,140,60,0.24)");
  assert.equal(liveTintForLens({ lensId: "snap-1", isSnapLens: true }), "rgba(232,185,59,0.18)");

  const raw = sanitizeLiveFx({
    v: 1,
    posterUrl: "file:///secret.jpg",
    posterMode: "cover",
    posterX: 2,
    posterY: -1,
    posterScale: 99,
    backgroundMode: "blur",
    backgroundUrl: "https://cdn.example/bg.jpg",
    lensId: "style-glow",
    lensName: "Glow",
    tint: "rgba(255,230,180,0.22)",
  });
  assert.equal(raw.posterUrl, null, "local poster must not be published");
  assert.equal(raw.posterMode, "off");
  assert.ok(raw.posterX <= 0.95 && raw.posterX >= 0.05);
  assert.ok(raw.posterScale <= 3);
  assert.equal(raw.backgroundMode, "blur");
  assert.equal(raw.backgroundUrl, null, "blur has no background url");

  const published = sanitizeLiveFx({
    posterUrl: "https://cdn.example/poster.png",
    posterMode: "cover",
    posterX: 0.4,
    posterY: 0.55,
    posterScale: 1.4,
    backgroundMode: "image",
    backgroundUrl: "https://cdn.example/bg.jpg",
    lensId: "style-rose",
    lensName: "Rose",
    tint: "rgba(255,90,150,0.18)",
  });
  assert.equal(published.posterMode, "cover");
  assert.equal(published.posterUrl, "https://cdn.example/poster.png");
  assert.equal(published.backgroundMode, "image");
  assert.equal(published.backgroundUrl, "https://cdn.example/bg.jpg");

  const roundtrip = decodeLiveFx(encodeLiveFx(published));
  assert.ok(roundtrip);
  assert.equal(liveFxEquals(published, roundtrip!), true);
  assert.equal(liveFxHasVisual(published), true);
  assert.equal(liveFxHasVisual(EMPTY_LIVE_FX), false);

  assert.equal(decodeLiveFx("not-json"), null);
  assert.equal(decodeLiveFx(new TextEncoder().encode('{"v":2}')), null);
  assert.equal(decodeLiveFx(new TextEncoder().encode("{}")) != null, true);

  console.log("live-fx: all checks passed");
}

run();
