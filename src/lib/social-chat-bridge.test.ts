import assert from "node:assert/strict";
import { socialMessagesToEvents, socialPromoText } from "./social-chat-logic.ts";

async function run() {
  assert.match(socialPromoText("Robe wax", true), /Enchère/);
  assert.match(socialPromoText("Robe wax", false), /vedette/);
  assert.match(socialPromoText(null, false), /Live shopping/);

  const first = socialMessagesToEvents({
    youtube: { messages: [{ id: "yt1", authorName: "Awa", text: "wow" }] },
    facebook: { messages: [{ id: "fb1", authorName: "Marc", text: "prix ?" }] },
  });
  assert.equal(first.length, 2);
  assert.equal(first[0]?.source, "youtube");
  assert.equal(first[1]?.source, "facebook");

  const again = socialMessagesToEvents({
    youtube: { messages: [{ id: "yt1", authorName: "Awa", text: "wow" }] },
    facebook: { messages: [] },
  });
  assert.equal(again.length, 0, "duplicate social ids must be skipped");
}

void run();
