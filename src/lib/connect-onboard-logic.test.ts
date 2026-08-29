import assert from "node:assert/strict";
import {
  buildConnectProductDescription,
  COMPANY_PERSON_TITLE,
  connectStatusFromFlags,
  connectUiPhase,
  kidiStoreUrl,
  stripeAccountLinkUrls,
  mapConnectOnboardError,
  parseStripeBusinessType,
  splitDisplayName,
} from "./connect-onboard-logic.ts";

function run() {
  assert.equal(parseStripeBusinessType("company"), "company");
  assert.equal(parseStripeBusinessType("individual"), "individual");
  assert.equal(parseStripeBusinessType(undefined), "individual");

  assert.equal(kidiStoreUrl("inesor"), "https://kidiplus.com/@inesor");
  assert.equal(kidiStoreUrl("@inesor"), "https://kidiplus.com/@inesor");
  assert.equal(kidiStoreUrl("  "), null);
  assert.equal(kidiStoreUrl(null), null);

  assert.deepEqual(splitDisplayName("Jean Dupont"), { first: "Jean", last: "Dupont" });
  assert.deepEqual(splitDisplayName("Inès"), { first: "Inès", last: "" });

  assert.match(buildConnectProductDescription({ displayName: "Inès" }), /Inès/);
  assert.match(buildConnectProductDescription({ displayName: "Inès", category: "Bijoux" }), /Bijoux/);

  assert.equal(COMPANY_PERSON_TITLE, "Propriétaire");
  assert.notEqual(COMPANY_PERSON_TITLE.toLowerCase(), "kidi+");

  assert.equal(connectStatusFromFlags({ payoutsEnabled: true }), "ready");
  assert.equal(connectStatusFromFlags({ payoutsEnabled: false, currentlyDue: ["individual.verification"] }), "needs_info");
  assert.equal(connectStatusFromFlags({}), "none");

  assert.equal(connectUiPhase({}), "choose");
  assert.equal(connectUiPhase({ connected: true, payoutsEnabled: false }), "needs_info");
  assert.equal(connectUiPhase({ status: "pending" }), "needs_info");
  assert.equal(connectUiPhase({ status: "restricted" }), "needs_info");
  assert.equal(connectUiPhase({ payoutsEnabled: true }), "ready");
  assert.equal(connectUiPhase({ status: "active" }), "ready");

  assert.equal(stripeAccountLinkUrls().returnUrl, "https://kidiplus.com/vendeur/stripe/retour");
  assert.ok(stripeAccountLinkUrls().refreshUrl.startsWith("https://"));

  assert.equal(mapConnectOnboardError("handle_missing").kind, "handle_missing");
  assert.match(mapConnectOnboardError("handle_missing").text, /boutique/);
  assert.equal(mapConnectOnboardError("server_error").kind, "server");

  console.log("connect-onboard-logic: all checks passed");
}

run();
