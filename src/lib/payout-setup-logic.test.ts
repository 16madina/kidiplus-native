import assert from "node:assert/strict";
import {
  anyPayoutMethodReady,
  applyDestinationToSetup,
  destinationFromSetup,
  emptyPayoutSetup,
  firstReadyPayoutMethod,
  formatConnectCountry,
  isConnectReturnUrl,
  isStripePayoutReady,
  isValidBankHolder,
  isValidIban,
  isValidPaypalEmail,
  isValidPayoutPhone,
  maskIban,
  maskPaypalEmail,
  maskPayoutPhone,
  parsePayoutSetup,
  payoutErrorI18nKey,
  payoutMethodReady,
  payoutSetupHasAny,
  payoutSetupToProfilePatch,
} from "./payout-setup-logic.ts";

function run() {
  assert.deepEqual(parsePayoutSetup(null), emptyPayoutSetup());
  assert.deepEqual(parsePayoutSetup("nope"), emptyPayoutSetup());
  assert.equal(payoutSetupHasAny(emptyPayoutSetup()), false);

  const parsed = parsePayoutSetup({
    payout_paypal_email: "  Ada@Kidiplus.com  ",
    payout_wave_phone: " +225 07 00 00 45 23 ",
    payout_bank_iban: "fr76 3000 6000 0112 3456 7890 189",
    payout_bank_holder: " Jean Dupont ",
    ignored: true,
  });
  assert.equal(parsed.paypalEmail, "ada@kidiplus.com");
  assert.equal(parsed.wavePhone, "+225 07 00 00 45 23");
  assert.equal(parsed.bankIban, "FR7630006000011234567890189");
  assert.equal(parsed.bankHolder, "Jean Dupont");
  assert.equal(payoutSetupHasAny(parsed), true);

  assert.equal(isValidPaypalEmail("ada@kidiplus.com"), true);
  assert.equal(isValidPaypalEmail("ada@"), false);
  assert.equal(isValidPayoutPhone("+2250700000000"), true);
  assert.equal(isValidPayoutPhone("0700000000"), false);
  assert.equal(isValidPayoutPhone("123"), false);
  assert.equal(isValidIban("FR7630006000011234567890189"), true);
  assert.equal(isValidIban("FR76 ACCT-000009"), false);
  assert.equal(isValidBankHolder("Jean"), true);
  assert.equal(isValidBankHolder("J"), false);
  assert.equal(isStripePayoutReady("active"), true);
  assert.equal(isStripePayoutReady("pending"), false);
  assert.equal(isStripePayoutReady("none"), false);
  assert.equal(isStripePayoutReady("active", false), false);
  assert.equal(isStripePayoutReady("active", true), true);
  assert.equal(isStripePayoutReady("pending", true, true), true);
  assert.equal(isStripePayoutReady("pending", null, true), true);
  assert.equal(isStripePayoutReady("pending", false, true), false);
  assert.equal(isStripePayoutReady("active", null), true);
  assert.equal(payoutErrorI18nKey("connect_not_ready"), "payout.errors.connectNotReady");
  assert.equal(payoutErrorI18nKey("connect_test_mode"), "payout.errors.connectTestMode");
  assert.equal(payoutErrorI18nKey("nope"), "payout.errors.generic");

  const empty = emptyPayoutSetup();
  assert.equal(payoutMethodReady("stripe_connect", empty, true), true);
  assert.equal(payoutMethodReady("stripe_connect", empty, false), false);
  assert.equal(payoutMethodReady("paypal", empty, true), false);
  assert.equal(payoutMethodReady("paypal", parsed, false), true);
  assert.equal(payoutMethodReady("wave", parsed, false), true);
  assert.equal(payoutMethodReady("orange_money", parsed, false), false);
  assert.equal(payoutMethodReady("bank_transfer", parsed, false), true);
  assert.equal(payoutMethodReady("bank_transfer", { ...parsed, bankHolder: "" }, false), false);

  const eur = ["stripe_connect", "paypal", "bank_transfer"] as const;
  const xof = ["wave", "orange_money", "paypal", "bank_transfer"] as const;

  assert.equal(anyPayoutMethodReady(eur, empty, false), false);
  assert.equal(anyPayoutMethodReady(eur, empty, true), true);
  assert.equal(firstReadyPayoutMethod(eur, empty, true), "stripe_connect");
  assert.equal(firstReadyPayoutMethod(eur, parsed, false), "paypal");
  assert.equal(firstReadyPayoutMethod(xof, empty, true), null);
  assert.equal(firstReadyPayoutMethod(xof, parsed, false), "wave");

  assert.deepEqual(destinationFromSetup("paypal", parsed), { paypalEmail: "ada@kidiplus.com" });
  assert.deepEqual(destinationFromSetup("wave", parsed), { phone: "+225 07 00 00 45 23" });
  assert.deepEqual(destinationFromSetup("stripe_connect", parsed), {});

  const after = applyDestinationToSetup(empty, "paypal", { paypalEmail: "  Sam@Kidi.plus " });
  assert.equal(after.paypalEmail, "sam@kidi.plus");
  const bank = applyDestinationToSetup(empty, "bank_transfer", {
    iban: "de89 3704 0044 0532 0130 00",
    holder: " Sam ",
  });
  assert.equal(bank.bankIban, "DE89370400440532013000");
  assert.equal(bank.bankHolder, "Sam");

  assert.deepEqual(payoutSetupToProfilePatch(parsed).payout_paypal_email, "ada@kidiplus.com");
  assert.equal(maskPaypalEmail("maria@gmail.com"), "m•••a@gmail.com");
  assert.equal(maskPayoutPhone("+2250700004523"), "+225 •••• 4523");
  assert.equal(maskIban("FR7630006000011234567890189"), "•••• 0189");
  assert.equal(isConnectReturnUrl("kidiplus://connect-return"), true);
  assert.equal(isConnectReturnUrl("kidiplus://connect-return?ok=1"), true);
  assert.equal(isConnectReturnUrl("kidiplus://paypal-done"), false);
  assert.ok(formatConnectCountry("FR", "fr").length > 0);

  console.log("payout-setup-logic: all checks passed");
}

run();
