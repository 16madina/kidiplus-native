import assert from "node:assert/strict";
import { PROFILE_MENU_TINT } from "./profile-menu-tints.ts";

function run() {
  const hex = /^#[0-9A-F]{6}$/;
  for (const [key, value] of Object.entries(PROFILE_MENU_TINT)) {
    assert.match(value, hex, key);
  }
  assert.equal(PROFILE_MENU_TINT.shop, "#DE3E2D");
  assert.equal(PROFILE_MENU_TINT.delivery, "#00878F");
  assert.equal(PROFILE_MENU_TINT.wallet, "#CA8A10");
  assert.equal(PROFILE_MENU_TINT.orders, "#0081F1");
  assert.equal(PROFILE_MENU_TINT.referral, "#E65F2A");
  assert.equal(PROFILE_MENU_TINT.admin, "#1F2D4C");
  assert.equal(PROFILE_MENU_TINT.signOut, "#EE0F1F");
  console.log("profile-menu-tints: all checks passed");
}

run();
