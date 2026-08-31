import assert from "node:assert/strict";
import test from "node:test";
import { mergeDeliveryFlags, prioritizeDeliverable } from "./delivery-feed-logic.ts";
import type { LiveStream } from "../mock/lives.ts";

function live(id: string, extra: Partial<LiveStream> = {}): LiveStream {
  return {
    id,
    seller: id,
    avatar: "",
    title: id,
    thumbnail: "",
    viewers: 0,
    category: "Fashion",
    ...extra,
  };
}

test("prioritizeDeliverable keeps deliverable lives first without hiding others", () => {
  const ranked = prioritizeDeliverable([
    live("a", { deliversToMe: false }),
    live("b", { deliversToMe: true }),
    live("c", { deliversToMe: undefined }),
    live("d", { deliversToMe: false }),
  ]);
  assert.deepEqual(
    ranked.map((l) => l.id),
    ["b", "c", "a", "d"],
  );
});

test("mergeDeliveryFlags skips demos and missing sellers", () => {
  const flags = new Map([
    ["seller-1", false],
    ["seller-2", true],
  ]);
  const merged = mergeDeliveryFlags(
    [
      live("demo", { fictitious: true, sellerId: "seller-1" }),
      live("ok", { sellerId: "seller-2" }),
      live("no", { sellerId: "seller-1" }),
      live("unknown"),
    ],
    flags,
  );
  assert.equal(merged[0].deliversToMe, undefined);
  assert.equal(merged[1].deliversToMe, true);
  assert.equal(merged[2].deliversToMe, false);
  assert.equal(merged[3].deliversToMe, undefined);
});
