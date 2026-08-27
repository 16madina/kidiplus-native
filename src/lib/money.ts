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
