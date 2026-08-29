// Lazy wrapper around @stripe/stripe-react-native so builds that predate the
// SDK don't crash at import time — card payment then reports "rebuild needed".

import { NativeModules, TurboModuleRegistry } from "react-native";

type StripeModule = {
  initStripe: (opts: { publishableKey: string }) => Promise<void>;
  initPaymentSheet: (opts: {
    paymentIntentClientSecret: string;
    merchantDisplayName: string;
    returnURL?: string;
    style?: "automatic" | "alwaysLight" | "alwaysDark";
  }) => Promise<{ error?: { message: string } }>;
  presentPaymentSheet: () => Promise<{ error?: { code?: string; message: string } }>;
};

let cached: StripeModule | null | undefined;

/** True only when StripeSdk is linked into this iOS/Android binary. */
function stripeNativePresent(): boolean {
  try {
    if (NativeModules.StripeSdk) return true;
  } catch {
    /* ignore */
  }
  try {
    return TurboModuleRegistry.get("StripeSdk") != null;
  } catch {
    return false;
  }
}

function loadStripe(): StripeModule | null {
  if (cached !== undefined) return cached;
  // Never require the JS package if the native binary lacks StripeSdk —
  // TurboModuleRegistry.getEnforcing throws a fatal redbox during evaluation.
  if (!stripeNativePresent()) {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require("@stripe/stripe-react-native") as StripeModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function stripeAvailable(): boolean {
  return loadStripe() !== null;
}

export type StripeSheetResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; error?: string };

/** Init + present the native Stripe PaymentSheet for a PaymentIntent. */
export async function presentStripePayment(args: {
  clientSecret: string;
  publishableKey: string;
  merchantName?: string;
}): Promise<StripeSheetResult> {
  const stripe = loadStripe();
  if (!stripe) {
    return { ok: false, cancelled: false, error: "stripe_module_missing" };
  }
  const pk = String(args.publishableKey ?? "").trim();
  if (!pk.startsWith("pk_")) {
    return { ok: false, cancelled: false, error: "Invalid API key provided" };
  }
  try {
    await stripe.initStripe({ publishableKey: pk });
    const init = await stripe.initPaymentSheet({
      paymentIntentClientSecret: args.clientSecret,
      merchantDisplayName: args.merchantName ?? "KiDi+",
      returnURL: "kidiplus://stripe-return",
      style: "automatic",
    });
    if (init.error) return { ok: false, cancelled: false, error: init.error.message };
    const res = await stripe.presentPaymentSheet();
    if (res.error) {
      const cancelled = res.error.code === "Canceled";
      return { ok: false, cancelled, ...(cancelled ? {} : { error: res.error.message }) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, cancelled: false, error: e instanceof Error ? e.message : "stripe_failed" };
  }
}
