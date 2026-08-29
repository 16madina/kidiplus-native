import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PayoutMethod } from "./earnings";
import { payoutMethodsForCurrency } from "./payout-methods";
import {
  anyPayoutMethodReady,
  emptyPayoutSetup,
  isStripePayoutReady,
  parsePayoutSetup,
  payoutSetupHasAny,
  type PayoutSetup,
} from "./payout-setup-logic";
import { fetchConnectStatus } from "./stripe-connect";
import { supabase } from "./supabase";

export type {
  PayoutSetup,
} from "./payout-setup-logic";
export {
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
} from "./payout-setup-logic";

const storageKey = (userId: string) => `kidiplus.payout-setup.v1.${userId}`;

export async function loadPayoutSetup(userId: string): Promise<PayoutSetup> {
  let fromDisk = emptyPayoutSetup();
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (raw) fromDisk = parsePayoutSetup(JSON.parse(raw));
  } catch {
    /* ignore corrupt cache */
  }

  try {
    const { data } = await supabase.auth.getUser();
    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    if (meta.payout_setup) {
      const fromMeta = parsePayoutSetup(meta.payout_setup);
      if (payoutSetupHasAny(fromMeta)) return fromMeta;
    }
  } catch {
    /* offline / unsigned */
  }

  return fromDisk;
}

export async function savePayoutSetup(userId: string, setup: PayoutSetup): Promise<void> {
  const next = parsePayoutSetup(setup);
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    await supabase.auth.updateUser({ data: { payout_setup: next } });
  } catch {
    /* local cache still holds */
  }
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
  const stripeReady = isStripePayoutReady(connect.status);
  const methods = payoutMethodsForCurrency(currency);
  return {
    setup,
    stripeReady,
    methods,
    canWithdraw: anyPayoutMethodReady(methods, setup, stripeReady),
  };
}
