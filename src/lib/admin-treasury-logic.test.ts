import assert from "node:assert/strict";
import {
  addMoneyMaps,
  amountOf,
  buildTreasurySnapshot,
  capPlatformPayout,
  commissionByCurrency,
  currenciesOf,
  fromStripeMinor,
  moneyFromStripeBalances,
  payoutableCommission,
  platformPayoutMinimum,
  reservedOnStripe,
  sumRowsByCurrency,
  toStripeMinor,
} from "./admin-treasury-logic.ts";

function run() {
  assert.deepEqual(addMoneyMaps({ CAD: 135.35 }, { CAD: 85.1 }, { EUR: 10 }), {
    CAD: 220.45,
    EUR: 10,
  });
  assert.equal(commissionByCurrency({ CAD: 50 }, { CAD: 20 }).CAD, 30);
  assert.equal(commissionByCurrency({ CAD: 0 }, { CAD: 220.45 }).CAD, -220.45);
  assert.equal(payoutableCommission(-10), 0);
  assert.equal(payoutableCommission(12.345), 12.35);
  assert.equal(fromStripeMinor(5035, "cad"), 50.35);
  assert.equal(toStripeMinor(50.35, "CAD"), 5035);
  assert.equal(fromStripeMinor(5000, "XOF"), 5000);

  assert.deepEqual(
    moneyFromStripeBalances([
      { amount: 13535, currency: "cad" },
      { amount: 200, currency: "eur" },
    ]),
    { CAD: 135.35, EUR: 2 },
  );

  assert.deepEqual(
    sumRowsByCurrency([
      { amount: 10, currency: "cad" },
      { amount: 5.1, currency: "CAD" },
    ]),
    { CAD: 15.1 },
  );

  const reserved = reservedOnStripe({ CAD: 20 }, { CAD: 15 });
  assert.equal(reserved.CAD, 35);

  const snap = buildTreasurySnapshot({
    stripeAvailable: { CAD: 100 },
    stripePending: { CAD: 8 },
    owedSellers: { CAD: 40 },
    walletFloat: { CAD: 25 },
  });
  assert.equal(snap.stripeTotal.CAD, 108);
  assert.equal(snap.reserved.CAD, 65);
  assert.equal(snap.commission.CAD, 35);
  assert.equal(snap.payoutable.CAD, 35);

  const empty = buildTreasurySnapshot({
    stripeAvailable: { CAD: 0 },
    stripePending: { CAD: 0 },
    owedSellers: { CAD: 220.45 },
    walletFloat: { CAD: 0 },
  });
  assert.equal(empty.commission.CAD, -220.45);
  assert.equal(empty.payoutable.CAD, 0);

  assert.equal(capPlatformPayout(50, 35, 100), 35);
  assert.equal(capPlatformPayout(50, 80, 20), 20);
  assert.equal(capPlatformPayout(-4, 10, 10), 0);
  assert.equal(platformPayoutMinimum("CAD"), 1);
  assert.equal(platformPayoutMinimum("xof"), 500);
  assert.deepEqual(currenciesOf({ CAD: 1 }, { EUR: 0 }), ["CAD", "EUR"]);
  assert.equal(amountOf({ cad: 3, CAD: 4 }, "cad"), 4);

  console.log("admin-treasury-logic: all checks passed");
}

run();
