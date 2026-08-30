import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PayoutMethod } from "./earnings";
import {
  anyPayoutMethodReady,
  emptyPayoutSetup,
  isStripePayoutReady,
  parsePayoutSetup,
  payoutSetupToProfilePatch,
  type PayoutSetup,
} from "./payout-setup-logic";
import { payoutMethodsForCurrency } from "./payout-methods";
import { fetchConnectStatus } from "./stripe-connect";
import { supabase } from "./supabase";

export type { PayoutSetup } from "./payout-setup-logic";
export {
  anyPayoutMethodReady,
  applyDestinationToSetup,
  destinationFromSetup,
  emptyPayoutSetup,
  firstReadyPayoutMethod,
  formatConnectCountry,
  isConnectReturnUrl,
  isStripePayoutReady,
  payoutErrorI18nKey,
  isValidBankHolder,
  isValidIban,
  isValidPaypalEmail,
  isValidPayoutPhone,
  maskIban,
  maskPaypalEmail,
  maskPayoutPhone,
  parsePayoutSetup,
  payoutMethodReady,
} from "./payout-setup-logic";
export { payoutSetupMethodsForCurrency } from "./payout-methods";

const storageKey = (userId: string) => `kidiplus.payout-setup.v1.${userId}`;

async function readCache(userId: string): Promise<PayoutSetup> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (raw) return parsePayoutSetup(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return emptyPayoutSetup();
}

async function writeCache(userId: string, setup: PayoutSetup): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(parsePayoutSetup(setup)));
  } catch {
    /* ignore */
  }
}

export async function loadPayoutSetup(userId: string): Promise<PayoutSetup> {
  const rpc = await supabase.rpc("get_my_payout_methods");
  if (!rpc.error && rpc.data && typeof rpc.data === "object") {
    const row = rpc.data as Record<string, unknown>;
    if (row.ok !== false) {
      const setup = parsePayoutSetup(row);
      await writeCache(userId, setup);
      return setup;
    }
  }

  const direct = await supabase
    .from("profiles")
    .select("payout_paypal_email, payout_wave_phone, payout_om_phone, payout_bank_iban, payout_bank_holder")
    .eq("id", userId)
    .maybeSingle();
  if (!direct.error && direct.data) {
    const setup = parsePayoutSetup(direct.data as Record<string, unknown>);
    await writeCache(userId, setup);
    return setup;
  }

  return readCache(userId);
}

export async function savePayoutSetup(
  userId: string,
  setup: PayoutSetup,
): Promise<{ ok: boolean; error?: string }> {
  const next = parsePayoutSetup(setup);
  const patch = payoutSetupToProfilePatch(next);

  const rpc = await supabase.rpc("update_my_payout_methods", { _patch: patch });
  if (!rpc.error && rpc.data && typeof rpc.data === "object") {
    const row = rpc.data as Record<string, unknown>;
    if (row.ok !== false) {
      await writeCache(userId, parsePayoutSetup(row));
      return { ok: true };
    }
    return { ok: false, error: String(row.error ?? "save_failed") };
  }

  const direct = await supabase.from("profiles").update(patch).eq("id", userId);
  if (!direct.error) {
    await writeCache(userId, next);
    return { ok: true };
  }

  await writeCache(userId, next);
  return { ok: false, error: direct.error.message || rpc.error?.message || "save_failed" };
}

export async function loadWithdrawReadiness(
  userId: string,
  currency: string | null | undefined,
): Promise<{
  setup: PayoutSetup;
  stripeReady: boolean;
  methods: PayoutMethod[];
  canWithdraw: boolean;
}> {
  const [setup, connect] = await Promise.all([loadPayoutSetup(userId), fetchConnectStatus()]);
  const stripeReady = isStripePayoutReady(connect.status, connect.livemode, connect.payoutsEnabled);
  const methods = payoutMethodsForCurrency(currency);
  return {
    setup,
    stripeReady,
    methods,
    canWithdraw: anyPayoutMethodReady(methods, setup, stripeReady),
  };
}
