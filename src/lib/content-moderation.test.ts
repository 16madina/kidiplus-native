import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUserTextAllowed,
  isContentBlockedError,
  moderateUserText,
  normalizeModerationText,
} from "./content-moderation.ts";

test("normalizes accents and common obfuscation", () => {
  assert.equal(normalizeModerationText("  M€NÀCÉ!!!  "), "menace");
});

test("allows normal marketplace and live messages", () => {
  assert.deepEqual(moderateUserText("Magnifique sac vintage, livraison à Montréal"), { allowed: true });
  assert.deepEqual(moderateUserText("Bravo pour ton live 🔥"), { allowed: true });
});

test("blocks severe threats and prohibited sales", () => {
  assert.deepEqual(moderateUserText("Je vais te tuer"), {
    allowed: false,
    reason: "violent_threat",
  });
  assert.deepEqual(moderateUserText("Cocaine à vendre livraison rapide"), {
    allowed: false,
    reason: "illegal_goods",
  });
});

test("throws a stable public error code", () => {
  assert.throws(
    () => assertUserTextAllowed("stolen credit card for sale"),
    (error) => isContentBlockedError(error),
  );
});
