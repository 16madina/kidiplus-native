import assert from "node:assert/strict";
import { paymentsModeFromEnv, pickStripeSecret, stripeSecretIsLive } from "./stripe-secret-logic.ts";

function run() {
  assert.equal(paymentsModeFromEnv("live"), "live");
  assert.equal(paymentsModeFromEnv("production"), "live");
  assert.equal(paymentsModeFromEnv("test"), "test");
  assert.equal(paymentsModeFromEnv("sandbox"), "test");
  assert.equal(stripeSecretIsLive("sk_live_abc"), true);
  assert.equal(stripeSecretIsLive("sk_test_abc"), false);

  const live = pickStripeSecret({
    paymentsMode: "live",
    secret: "sk_test_old",
    live: "sk_live_real",
  });
  assert.equal(live.ok, true);
  if (live.ok) {
    assert.equal(live.secret, "sk_live_real");
    assert.equal(live.mode, "live");
  }

  const refuseTest = pickStripeSecret({
    paymentsMode: "live",
    secret: "sk_test_only",
    live: "not-a-key",
  });
  assert.equal(refuseTest.ok, false);

  const test = pickStripeSecret({
    paymentsMode: "test",
    secret: "sk_live_nope",
    sandbox: "sk_test_sandbox",
  });
  assert.equal(test.ok, true);
  if (test.ok) assert.equal(test.secret, "sk_test_sandbox");

  console.log("stripe-secret-logic: all checks passed");
}

run();
