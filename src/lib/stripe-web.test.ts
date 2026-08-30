import assert from "node:assert/strict";
import { KIDI_STRIPE_PUBLISHABLE_KEY, normalizePublishableKey } from "./stripe-web.ts";

function run() {
  assert.ok(KIDI_STRIPE_PUBLISHABLE_KEY.startsWith("pk_live_"));
  assert.equal(normalizePublishableKey(undefined), KIDI_STRIPE_PUBLISHABLE_KEY);
  assert.equal(normalizePublishableKey(""), KIDI_STRIPE_PUBLISHABLE_KEY);
  assert.equal(
    normalizePublishableKey("pk_live_51SYGiOPn7aesiMlZxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxDBMx"),
    KIDI_STRIPE_PUBLISHABLE_KEY,
  );
  assert.equal(normalizePublishableKey("pk_test_abc123"), "pk_test_abc123");
  console.log("stripe-web: all checks passed");
}

run();
