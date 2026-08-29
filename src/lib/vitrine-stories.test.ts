import assert from "node:assert/strict";
import {
  filterBlockedStories,
  isStoryVideoUrl,
  storiesHiddenByFeedIndex,
  storyExpiresAt,
  STORY_TTL_MS,
} from "./vitrine-story-logic.ts";

function run() {
  assert.equal(isStoryVideoUrl("https://x/a.mp4"), true);
  assert.equal(isStoryVideoUrl("https://x/a.mov?tok=1"), true);
  assert.equal(isStoryVideoUrl("https://x/a.jpg"), false);

  const from = Date.parse("2026-08-29T00:00:00.000Z");
  assert.equal(storyExpiresAt(from), new Date(from + STORY_TTL_MS).toISOString());

  assert.equal(storiesHiddenByFeedIndex(0), false);
  assert.equal(storiesHiddenByFeedIndex(1), true);
  assert.equal(storiesHiddenByFeedIndex(4), true);

  const list = [
    { userId: "u1", id: "1" },
    { userId: "u2", id: "2" },
  ];
  assert.deepEqual(
    filterBlockedStories(list, new Set(["u2"])).map((s) => s.id),
    ["1"],
  );
}

run();
console.log("vitrine-stories.test.ts ok");
