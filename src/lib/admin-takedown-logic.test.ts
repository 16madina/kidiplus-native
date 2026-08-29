import assert from "node:assert/strict";
import {
  encodeContentReportNote,
  mediaFromKind,
  parseReportContentRef,
  takedownCopy,
} from "./admin-takedown-logic.ts";

function run() {
  const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const note = encodeContentReportNote("vitrine_post", id, "Vitrine post: " + id);
  assert.match(note, /\[kidiContent:vitrine_post:/);
  assert.deepEqual(parseReportContentRef({ note }), { kind: "vitrine_post", contentId: id });
  assert.deepEqual(parseReportContentRef({ note: `Vitrine post: ${id}` }), {
    kind: "vitrine_post",
    contentId: id,
  });
  assert.deepEqual(parseReportContentRef({ note: `Vitrine story: ${id}` }), {
    kind: "vitrine_story",
    contentId: id,
  });
  assert.deepEqual(parseReportContentRef({ target_type: "live", target_id: id }), {
    kind: "live",
    contentId: id,
  });
  assert.equal(parseReportContentRef({ target_type: "user", target_id: id, note: "spam" }), null);

  const fr = takedownCopy("vitrine_post", "video", "fr");
  assert.match(fr.body, /vidéo/);
  assert.match(fr.body, /KiDi\+/);
  const live = takedownCopy("live", "live", "fr");
  assert.match(live.body, /live/);
  assert.equal(mediaFromKind("live"), "live");
  assert.equal(mediaFromKind("vitrine_post", "video"), "video");
  assert.equal(mediaFromKind("vitrine_post", "image"), "photo");
}

run();
console.log("admin-takedown-logic.test.ts ok");
