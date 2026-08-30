import assert from "node:assert/strict";
import {
  buildConnectProductDescription,
  COMPANY_PERSON_TITLE,
  connectStatusFromAccount,
  connectStatusFromFlags,
  connectUiPhase,
  kidiStoreUrl,
  stripeAccountLinkUrls,
  isStaleConnectAccountError,
  mapConnectOnboardError,
  parseStripeBusinessType,
  isoCountryFromLabel,
  pickStripeConnectCountry,
  splitDisplayName,
  stripeConnectAvailable,
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
  assert.equal(connectUiPhase({ payoutsEnabled: true, livemode: false }), "test");
  assert.equal(connectUiPhase({ status: "active", livemode: false }), "test");
  assert.equal(connectStatusFromAccount({ payouts_enabled: true, livemode: true }), "active");
  assert.equal(connectStatusFromAccount({ payouts_enabled: true, livemode: false }), "pending");
  assert.equal(connectStatusFromAccount({ payouts_enabled: true }), "pending");
  assert.equal(
    connectStatusFromAccount({
      details_submitted: true,
      livemode: true,
      requirements: { currently_due: [], past_due: [] },
    }),
    "active",
  );

  assert.ok(stripeAccountLinkUrls().returnUrl.includes("connect-bounce"));
  assert.ok(stripeAccountLinkUrls().refreshUrl.includes("next=refresh"));

  assert.equal(isoCountryFromLabel("Canada"), "CA");
  assert.equal(isoCountryFromLabel("🇨🇦 Canada"), "CA");
  assert.equal(isoCountryFromLabel("Australie"), "AU");
  assert.equal(isoCountryFromLabel("Australia"), "AU");
  assert.equal(isoCountryFromLabel("États-Unis"), "US");
  assert.equal(isoCountryFromLabel("United States"), "US");
  assert.equal(isoCountryFromLabel("France"), "FR");
  assert.equal(isoCountryFromLabel("Allemagne"), "DE");
  assert.equal(pickStripeConnectCountry("Canada", "CI", "EUR"), "CA");
  assert.equal(pickStripeConnectCountry("Australie", null, "USD"), "AU");
  assert.equal(pickStripeConnectCountry("États-Unis", null, "EUR"), "US");
  assert.equal(pickStripeConnectCountry("France", null, "CAD"), "FR");
  assert.equal(pickStripeConnectCountry("CI", "CI", "CAD"), "CA");
  assert.equal(pickStripeConnectCountry("CI", "CI", "EUR"), "FR");
  assert.equal(pickStripeConnectCountry("SN", null, "EUR"), "FR");
  assert.equal(pickStripeConnectCountry(null, "CA", "CAD"), "CA");
  assert.equal(pickStripeConnectCountry(null, null, "USD"), "US");
  assert.equal(stripeConnectAvailable("XOF"), false);
  assert.equal(stripeConnectAvailable("EUR"), true);
  assert.equal(stripeConnectAvailable("CAD"), true);
  assert.equal(stripeConnectAvailable("USD"), true);
  assert.equal(stripeConnectAvailable("GBP"), true);

  assert.equal(mapConnectOnboardError("handle_missing").kind, "handle_missing");
  assert.match(mapConnectOnboardError("handle_missing").text, /boutique/);
  assert.equal(mapConnectOnboardError("server_error").kind, "server");
  assert.equal(
    isStaleConnectAccountError(
      "You requested an account link for an account that is not connected to your platform or does not exist.",
    ),
    true,
  );
  assert.match(
    mapConnectOnboardError(
      "server_error",
      "Error: You requested an account link for an account that is not connected to your platform or does not exist.",
    ).text,
    /nouveau/,
  );
  assert.match(
    mapConnectOnboardError(
      "server_error",
      "Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.",
    ).text,
    /platform-profile/,
  );

  console.log("connect-onboard-logic: all checks passed");
}

run();
