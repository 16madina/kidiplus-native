import assert from "node:assert/strict";
import {
  anyPayoutMethodReady,
  applyDestinationToSetup,
  destinationFromSetup,
  emptyPayoutSetup,
  firstReadyPayoutMethod,
  isStripePayoutReady,
  isValidIban,
  isValidPaypalEmail,
  isValidPayoutPhone,
  parsePayoutSetup,
  payoutMethodReady,
  payoutSetupHasAny,
} from "./payout-setup-logic.ts";

function run() {
  assert.deepEqual(parsePayoutSetup(null), emptyPayoutSetup());
  assert.deepEqual(parsePayoutSetup("nope"), emptyPayoutSetup());
  assert.equal(payoutSetupHasAny(emptyPayoutSetup()), false);

  const parsed = parsePayoutSetup({
    paypalEmail: "  Ada@Kidiplus.com  ",
    wavePhone: " 07 00 00 00 00 ",
    bankIban: "fr76 3000 6000 0112 3456 7890 189",
    ignored: true,
  });
  assert.equal(parsed.paypalEmail, "ada@kidiplus.com");
  assert.equal(parsed.wavePhone, "07 00 00 00 00");
  assert.equal(parsed.bankIban, "FR7630006000011234567890189");
  assert.equal(payoutSetupHasAny(parsed), true);

  assert.equal(isValidPaypalEmail("ada@kidiplus.com"), true);
  assert.equal(isValidPaypalEmail("ada@"), false);
  assert.equal(isValidPayoutPhone("+2250700000000"), true);
  assert.equal(isValidPayoutPhone("123"), false);
  assert.equal(isValidIban("FR7630006000011234567890189"), true);
  assert.equal(isValidIban("FR76"), false);
  assert.equal(isStripePayoutReady("active"), true);
  assert.equal(isStripePayoutReady("pending"), false);
  assert.equal(isStripePayoutReady("none"), false);

  const empty = emptyPayoutSetup();
  assert.equal(payoutMethodReady("stripe_connect", empty, true), true);
  assert.equal(payoutMethodReady("stripe_connect", empty, false), false);
  assert.equal(payoutMethodReady("paypal", empty, true), false);
  assert.equal(payoutMethodReady("paypal", parsed, false), true);
  assert.equal(payoutMethodReady("wave", parsed, false), true);
  assert.equal(payoutMethodReady("orange_money", parsed, false), false);
  assert.equal(payoutMethodReady("bank_transfer", parsed, false), true);

  const eur = ["stripe_connect", "paypal", "bank_transfer"] as const;
  const xof = ["wave", "orange_money", "paypal", "bank_transfer"] as const;
  assert.equal(anyPayoutMethodReady(eur, empty, false), false);
  assert.equal(anyPayoutMethodReady(eur, empty, true), true);
  assert.equal(firstReadyPayoutMethod(eur, empty, true), "stripe_connect");
  assert.equal(firstReadyPayoutMethod(eur, parsed, false), "paypal");
  assert.equal(firstReadyPayoutMethod(xof, empty, true), null);
  assert.equal(firstReadyPayoutMethod(xof, parsed, false), "wave");

  assert.deepEqual(destinationFromSetup("paypal", parsed), { paypalEmail: "ada@kidiplus.com" });
  assert.deepEqual(destinationFromSetup("wave", parsed), { phone: "07 00 00 00 00" });
  assert.deepEqual(destinationFromSetup("stripe_connect", parsed), {});

  const after = applyDestinationToSetup(empty, "paypal", { paypalEmail: "  Sam@Kidi.plus " });
  assert.equal(after.paypalEmail, "sam@kidi.plus");
  const bank = applyDestinationToSetup(empty, "bank_transfer", {
    iban: "de89 3704 0044 0532 0130 00",
    holder: " Sam ",
  });
  assert.equal(bank.bankIban, "DE89370400440532013000");
  assert.equal(bank.bankHolder, "Sam");

  console.log("payout-setup-logic: all checks passed");
}

run();
