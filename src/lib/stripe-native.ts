// Lazy wrapper around @stripe/stripe-react-native so builds that predate the
// SDK don't crash at import time — card payment then reports "rebuild needed".

type StripeModule = {
  initStripe: (opts: { publishableKey: string }) => Promise<void>;
  initPaymentSheet: (opts: {
    paymentIntentClientSecret: string;
    merchantDisplayName: string;
    style?: "automatic" | "alwaysLight" | "alwaysDark";
  }) => Promise<{ error?: { message: string } }>;
  presentPaymentSheet: () => Promise<{ error?: { code?: string; message: string } }>;
};

let cached: StripeModule | null | undefined;

function loadStripe(): StripeModule | null {
  if (cached !== undefined) return cached;
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
  try {
    await stripe.initStripe({ publishableKey: args.publishableKey });
    const init = await stripe.initPaymentSheet({
      paymentIntentClientSecret: args.clientSecret,
      merchantDisplayName: args.merchantName ?? "KiDi+",
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
