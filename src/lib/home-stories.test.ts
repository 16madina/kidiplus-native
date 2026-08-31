import assert from "node:assert/strict";
import {
  applySeenFlags,
  firstUnreadIndex,
  groupStoriesBySeller,
  splitOwnStories,
  storyCardBadge,
  storyCardTone,
} from "./home-stories.ts";
import type { VitrineStory } from "./vitrine-stories.ts";

function story(over: Partial<VitrineStory> = {}): VitrineStory {
  return {
    id: "s1",
    userId: "u1",
    mediaUrl: "https://x/a.jpg",
    posterUrl: null,
    displayName: "Aïcha Boutique",
    handle: "aicha",
    avatarUrl: "https://x/av.jpg",
    createdAt: "",
    expiresAt: "",
    unread: true,
    clip: null,
    ...over,
  };
}

function run() {
  assert.equal(storyCardTone(true, false), "unread");
  assert.equal(storyCardTone(false, false), "read");
  assert.equal(storyCardTone(true, true), "live");
  assert.equal(storyCardTone(false, true), "live");
  assert.equal(storyCardBadge("unread"), "new");
  assert.equal(storyCardBadge("read"), null);
  assert.equal(storyCardBadge("live"), "live");

  const a1 = story({ id: "a1", userId: "a", unread: true });
  const a2 = story({ id: "a2", userId: "a", unread: false, displayName: "Aïcha Boutique" });
  const b1 = story({ id: "b1", userId: "b", displayName: "Léa", unread: false });
  const grouped = groupStoriesBySeller([a1, a2, b1]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].userId, "a");
  assert.equal(grouped[0].items.length, 2);
  assert.equal(grouped[0].unread, true);
  assert.equal(grouped[1].unread, false);

  const flagged = applySeenFlags([a1, b1], new Set(["a1"]));
  assert.equal(flagged[0].unread, false);
  assert.equal(flagged[1].unread, true);

  const split = splitOwnStories([a1, b1], "a");
  assert.equal(split.own.length, 1);
  assert.equal(split.others[0].userId, "b");

  assert.equal(firstUnreadIndex([a2, a1]), 1);
  assert.equal(firstUnreadIndex([a2, b1]), 0);
  console.log("home-stories: all checks passed");
}

run();
