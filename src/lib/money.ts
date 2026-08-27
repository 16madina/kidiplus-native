export type Currency = "XOF" | "EUR" | "CAD" | "USD" | "GBP";

const SUPPORTED: readonly Currency[] = ["XOF", "EUR", "CAD", "USD", "GBP"];

export function normalizeCurrency(input: string | null | undefined): Currency {
  const c = (input ?? "").toUpperCase();
  return (SUPPORTED as readonly string[]).includes(c) ? (c as Currency) : "EUR";
}

export function isZeroDecimal(currency: Currency): boolean {
  return currency === "XOF";
}

function intlLocale(currency: Currency, locale: string): string {
  const lang = (locale || "fr").toLowerCase().slice(0, 2);
  if (lang === "en") return currency === "USD" ? "en-US" : "en-GB";
  return currency === "CAD" ? "fr-CA" : "fr-FR";
}

/** Format a major-unit amount (same as Superbase / kidiplus.com). */
export function currencySymbol(currency: string | null | undefined): string {
  const cur = normalizeCurrency(currency);
  if (cur === "XOF") return "FCFA";
  if (cur === "EUR") return "€";
  if (cur === "GBP") return "£";
  if (cur === "CAD") return "$ CA";
  return "$";
}

/** Currency-aware rounding: XOF → integer, others → 2 decimals. */
export function roundForCurrency(amount: number, currency: Currency): number {
  if (isZeroDecimal(currency)) return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

type BidRules = { step: number; smallStep: number; threshold: number };

export function bidRulesFor(currency: Currency): BidRules {
  switch (currency) {
    case "XOF": return { step: 500, smallStep: 250, threshold: 5000 };
    case "CAD": return { step: 1, smallStep: 1, threshold: 0 };
    case "EUR":
    case "USD":
    case "GBP":
    default:    return { step: 1, smallStep: 0.5, threshold: 10 };
  }
}

/** Next bid increment for a current price in the given currency. */
export function nextBidAmount(currentPrice: number, currency: Currency): number {
  const rules = bidRulesFor(currency);
  const step = currentPrice < rules.threshold ? rules.smallStep : rules.step;
  return roundForCurrency(currentPrice + step, currency);
}

export function formatMoney(
  amount: number,
  currency: string | null | undefined = "EUR",
  locale = "fr",
): string {
  const cur = normalizeCurrency(currency);
  const digits = isZeroDecimal(cur) ? 0 : 2;
  if (cur === "XOF") {
    const nf = new Intl.NumberFormat(intlLocale(cur, locale), {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    return `${nf.format(Math.round(amount))} FCFA`;
  }
  try {
    return new Intl.NumberFormat(intlLocale(cur, locale), {
      style: "currency",
      currency: cur,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(digits)} ${cur}`;
  }
}
