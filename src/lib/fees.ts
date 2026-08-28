// Platform economics — display constants only.
// Money movement is ALWAYS computed on kidiplus.com / Supabase
// (`computeFees` + `public.platform_fee_rate()`). The native app must not
// invent charges, application fees, or seller_net — it shows server values.
//
// RULE: buyer pays listed price. KiDi+ keeps 10% of the ITEM (not shipping).
// Seller receives 90% + full delivery. Example: 100 + 15 shipping →
// buyer 115, KiDi+ 10, seller 105.
//
// Typical live path: buyer tops up wallet (Stripe/PayPal) → wallet pays the
// order instantly → 90% goes to seller_balances.pending (escrow).
// Stripe Connect destination charges are only for rare direct-card checkouts
// when the seller already has an active Express account.

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

/** Anti-fraud caps mirrored in SQL `credit_wallet_topup` / `request_payout`. */
export const MAX_WALLET_BALANCE: Record<Currency, number> = {
  XOF: 1_000_000,
  EUR: 2_000,
  CAD: 3_000,
  USD: 2_200,
  GBP: 1_800,
};
export const MAX_TOPUP_PER_DAY: Record<Currency, number> = MAX_WALLET_BALANCE;
export const MAX_PAYOUT_PER_DAY: Record<Currency, number> = MAX_WALLET_BALANCE;

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
