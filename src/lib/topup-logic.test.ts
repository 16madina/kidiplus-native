import assert from "node:assert/strict";
import {
  isAfricaVisaTopUp,
  parseTopUpAmount,
  paypalDebitEurFromXof,
  topUpLimits,
  topUpPayMethodsForCurrency,
} from "./topup-logic.ts";

function run() {
  assert.deepEqual(topUpLimits("XOF"), { min: 1000, max: 300_000 });
  assert.deepEqual(topUpLimits("EUR"), { min: 2, max: 500 });
  assert.deepEqual(topUpLimits("USD"), { min: 2, max: 500 });

  assert.deepEqual(topUpPayMethodsForCurrency("EUR"), ["card", "paypal"]);
  assert.deepEqual(topUpPayMethodsForCurrency("CAD"), ["card", "paypal"]);
  assert.deepEqual(topUpPayMethodsForCurrency("XOF"), [
    "card",
    "wave_visa",
    "orange_visa",
    "djamo",
    "paypal",
  ]);
  assert.equal(topUpPayMethodsForCurrency("XOF").includes("wave_visa"), true);
  assert.equal(isAfricaVisaTopUp("wave_visa"), true);
  assert.equal(isAfricaVisaTopUp("card"), false);

  assert.equal(parseTopUpAmount("5000", "XOF").ok, true);
  assert.equal(parseTopUpAmount("500", "XOF").ok, false);
  assert.equal(parseTopUpAmount("abc", "EUR").ok, false);
  assert.equal(parseTopUpAmount("1", "EUR").ok, false);
  assert.equal(parseTopUpAmount("10", "EUR").ok, true);

  assert.equal(paypalDebitEurFromXof(655.957), 1);
  assert.equal(paypalDebitEurFromXof(10_000), 15.25);

  console.log("topup-logic: all checks passed");
}

run();
