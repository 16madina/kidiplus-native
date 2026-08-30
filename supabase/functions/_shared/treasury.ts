/** Keep in sync with src/lib/admin-treasury-logic.ts */

export type MoneyByCur = Record<string, number>;

export function addMoneyMaps(...maps: MoneyByCur[]): MoneyByCur {
  const out: MoneyByCur = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map ?? {})) {
      const key = k.toUpperCase();
      out[key] = (out[key] ?? 0) + Number(v || 0);
    }
  }
  return out;
}

export function amountOf(map: MoneyByCur | null | undefined, currency: string): number {
  if (!map) return 0;
  const key = currency.toUpperCase();
  return Number(map[key] ?? map[currency] ?? 0);
}

export function commissionByCurrency(stripeAvailable: MoneyByCur, reserved: MoneyByCur): MoneyByCur {
  const keys = new Set([
    ...Object.keys(stripeAvailable ?? {}).map((k) => k.toUpperCase()),
    ...Object.keys(reserved ?? {}).map((k) => k.toUpperCase()),
  ]);
  const out: MoneyByCur = {};
  for (const k of keys) {
    out[k] = Number(amountOf(stripeAvailable, k) - amountOf(reserved, k));
  }
  return out;
}

export function payoutableCommission(commission: number): number {
  if (!Number.isFinite(commission) || commission <= 0) return 0;
  return Math.round(commission * 100) / 100;
}

export function payoutableByCurrency(commission: MoneyByCur): MoneyByCur {
  const out: MoneyByCur = {};
  for (const [k, v] of Object.entries(commission ?? {})) {
    out[k.toUpperCase()] = payoutableCommission(Number(v));
  }
  return out;
}

export function fromStripeMinor(amount: number, currency: string): number {
  const cur = currency.toUpperCase();
  if (cur === "XOF") return Math.round(amount);
  return Math.round(amount) / 100;
}

export function toStripeMinor(amount: number, currency: string): number {
  const cur = currency.toUpperCase();
  if (cur === "XOF") return Math.round(amount);
  return Math.round(amount * 100);
}

export function moneyFromStripeBalances(
  items: Array<{ amount?: number; currency?: string }> | null | undefined,
): MoneyByCur {
  const out: MoneyByCur = {};
  for (const item of items ?? []) {
    const cur = String(item.currency ?? "").toUpperCase();
    if (!cur) continue;
    out[cur] = (out[cur] ?? 0) + fromStripeMinor(Number(item.amount ?? 0), cur);
  }
  return out;
}

export function reservedOnStripe(owedSellers: MoneyByCur, walletFloat: MoneyByCur): MoneyByCur {
  return addMoneyMaps(owedSellers, walletFloat);
}

export function platformPayoutMinimum(currency: string): number {
  return currency.toUpperCase() === "XOF" ? 500 : 1;
}

export function capPlatformPayout(
  requested: number,
  payoutable: number,
  stripeAvailable: number,
): number {
  return payoutableCommission(
    Math.min(
      payoutableCommission(requested),
      payoutableCommission(payoutable),
      payoutableCommission(stripeAvailable),
    ),
  );
}

export function buildTreasurySnapshot(input: {
  stripeAvailable: MoneyByCur;
  stripePending: MoneyByCur;
  owedSellers: MoneyByCur;
  walletFloat: MoneyByCur;
}): {
  stripeTotal: MoneyByCur;
  reserved: MoneyByCur;
  commission: MoneyByCur;
  payoutable: MoneyByCur;
} {
  const reserved = reservedOnStripe(input.owedSellers, input.walletFloat);
  const commission = commissionByCurrency(input.stripeAvailable, reserved);
  return {
    stripeTotal: addMoneyMaps(input.stripeAvailable, input.stripePending),
    reserved,
    commission,
    payoutable: payoutableByCurrency(commission),
  };
}
