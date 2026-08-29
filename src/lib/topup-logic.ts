/** Buyer wallet deposit — limits, methods and XOF→EUR PayPal debit (BCEAO peg). */

export type TopUpPayMethod = "card" | "paypal" | "wave_visa" | "orange_visa" | "djamo";

const XOF_PER_EUR = 655.957;

function isXof(currency: string | null | undefined): boolean {
  return (currency ?? "").toUpperCase() === "XOF";
}

export function topUpLimits(currency: string | null | undefined): { min: number; max: number } {
  if (isXof(currency)) return { min: 1000, max: 300_000 };
  return { min: 2, max: 500 };
}

export function topUpPayMethodsForCurrency(currency: string | null | undefined): TopUpPayMethod[] {
  if (isXof(currency)) return ["card", "wave_visa", "orange_visa", "djamo", "paypal"];
  return ["card", "paypal"];
}

export function isAfricaVisaTopUp(method: TopUpPayMethod): boolean {
  return method === "wave_visa" || method === "orange_visa" || method === "djamo";
}

/** Official BCEAO peg — wallet stays in XOF, PayPal charges EUR. */
export function paypalDebitEurFromXof(amountXof: number): number {
  if (!Number.isFinite(amountXof) || amountXof <= 0) return 0;
  return Math.ceil((amountXof / XOF_PER_EUR) * 100) / 100;
}

export function parseTopUpAmount(
  raw: string,
  currency: string | null | undefined,
): { ok: true; amount: number } | { ok: false; reason: "invalid" | "range"; min: number; max: number } {
  const limits = topUpLimits(currency);
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "invalid", ...limits };
  if (n < limits.min || n > limits.max) return { ok: false, reason: "range", ...limits };
  return { ok: true, amount: n };
}
