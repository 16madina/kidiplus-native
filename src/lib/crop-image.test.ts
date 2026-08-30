import assert from "node:assert/strict";
import { cropCoverImage, isImageManipulatorAvailable } from "./crop-image.ts";

async function run() {
  assert.equal(isImageManipulatorAvailable(), false);
  const uri = "file:///tmp/photo.jpg";
  const out = await cropCoverImage(uri, { originX: 10, originY: 20, width: 100, height: 200 });
  assert.equal(out, uri);
  console.log("crop-image: all checks passed");
}

void run();
