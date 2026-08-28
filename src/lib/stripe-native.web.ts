export function stripeAvailable(): boolean {
  return false;
}

export type StripeSheetResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; error?: string };

export async function presentStripePayment(_args: {
  clientSecret: string;
  publishableKey: string;
  merchantName?: string;
}): Promise<StripeSheetResult> {
  return { ok: false, cancelled: false, error: "stripe_web_unsupported" };
}
