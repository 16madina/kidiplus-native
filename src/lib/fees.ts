// Platform economics — mirrors kidiplus.com `src/lib/fees.ts`.
//
// COMMISSION MODEL:
//   - Buyer pays the item price. total = amount (+ shipping).
//   - Platform commission (PLATFORM_FEE_PERCENT) is deducted from the seller.
//     seller_net = amount − platform_fee (+ shipping, which is pass-through).
//   - Stripe Connect destination charges keep the same cut as `application_fee_amount`.
//   - PayPal captures the full amount on the platform account; SQL then credits
//     seller_net to escrow. Same 10 % / 90 % split.
//   - When the buyer or seller used a referral code, `credit_referral_for_order`
//     sends that 10 % to the referrer's referral card instead of KiDi+.

import { isZeroDecimal, normalizeCurrency, roundForCurrency, type Currency } from "./money";

/** Single source of truth for the KiDi+ platform commission. */
export const PLATFORM_FEE_PERCENT = 10;
export const PLATFORM_FEE_RATE = PLATFORM_FEE_PERCENT / 100;

export const PAYOUT_MINIMUMS: Record<Currency, number> = {
  XOF: 5000,
  EUR: 10,
  CAD: 15,
  USD: 12,
  GBP: 10,
};

export function payoutMinimumFor(currency: string | null | undefined): number {
  return PAYOUT_MINIMUMS[normalizeCurrency(currency)];
}

export type FeeBreakdown = {
  amount: number;
  shipping: number;
  platformFee: number;
  processingFee: number;
  sellerNet: number;
  total: number;
  currency: Currency;
};

export function computeFees(
  amount: number,
  delivery = 0,
  currency: string | null | undefined = "EUR",
): FeeBreakdown {
  const cur = normalizeCurrency(currency);
  const round = (n: number) => roundForCurrency(n, cur);
  const a = round(amount);
  const s = round(delivery);
  const platformFee = round((a * PLATFORM_FEE_PERCENT) / 100);
  const sellerNet = round(a - platformFee + s);
  const total = round(a + s);
  return {
    amount: a,
    shipping: s,
    platformFee,
    processingFee: 0,
    sellerNet,
    total,
    currency: cur,
  };
}

export function feePercentOf(amount: number, platformFee: number): number {
  if (!(amount > 0)) return PLATFORM_FEE_PERCENT;
  return Math.round((platformFee / amount) * 100);
}

export function toStripeAmountFor(amount: number, currency: string): number {
  const cur = normalizeCurrency(currency);
  return isZeroDecimal(cur) ? Math.round(amount) : Math.round(amount * 100);
}
