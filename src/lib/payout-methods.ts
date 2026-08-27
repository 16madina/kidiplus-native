import { normalizeCurrency } from "./money";
import type { PayoutMethod } from "./earnings";

/** Same rule as kidiplus.com withdraw-sheet: mobile money only for XOF. */
export function payoutMethodsForCurrency(currency: string | null | undefined): PayoutMethod[] {
  const cur = normalizeCurrency(currency);
  if (cur === "XOF") return ["wave", "orange_money", "paypal", "bank_transfer"];
  return ["stripe_connect", "paypal", "bank_transfer"];
}

export function defaultPayoutMethod(currency: string | null | undefined): PayoutMethod {
  return payoutMethodsForCurrency(currency)[0] ?? "paypal";
}
