import { normalizeCurrency } from "./money";
import type { PayoutMethod } from "./earnings";

/** Withdraw + setup screen: Stripe only outside XOF; Wave / OM only for XOF. */
export function payoutMethodsForCurrency(currency: string | null | undefined): PayoutMethod[] {
  const cur = normalizeCurrency(currency);
  if (cur === "XOF") return ["wave", "orange_money", "paypal", "bank_transfer"];
  return ["stripe_connect", "paypal", "bank_transfer"];
}

export function defaultPayoutMethod(currency: string | null | undefined): PayoutMethod {
  return payoutMethodsForCurrency(currency)[0] ?? "paypal";
}

/** Same visibility as the withdraw sheet — setup screen must stay in sync. */
export const payoutSetupMethodsForCurrency = payoutMethodsForCurrency;
