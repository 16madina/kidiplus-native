/** Same rule as the app: Connect for every non-XOF wallet. Country = registered ISO if Stripe hosts it, else currency. */

export const STRIPE_CONNECT_COUNTRIES = new Set([
  "AE", "AT", "AU", "BE", "BG", "BR", "CA", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GI", "GR", "HK", "HR", "HU", "IE", "IT", "JP", "LI", "LT", "LU",
  "LV", "MT", "MX", "MY", "NL", "NO", "NZ", "PL", "PT", "RO", "SE", "SG", "SI", "SK",
  "TH", "US",
]);

const NAME_TO_ISO: Record<string, string> = {
  australia: "AU",
  australie: "AU",
  austria: "AT",
  autriche: "AT",
  belgium: "BE",
  belgique: "BE",
  brazil: "BR",
  bresil: "BR",
  bulgaria: "BG",
  bulgarie: "BG",
  canada: "CA",
  switzerland: "CH",
  suisse: "CH",
  cyprus: "CY",
  chypre: "CY",
  "czech republic": "CZ",
  tchequie: "CZ",
  germany: "DE",
  allemagne: "DE",
  denmark: "DK",
  danemark: "DK",
  estonia: "EE",
  estonie: "EE",
  spain: "ES",
  espagne: "ES",
  finland: "FI",
  finlande: "FI",
  france: "FR",
  "united kingdom": "GB",
  "royaume uni": "GB",
  "hong kong": "HK",
  croatia: "HR",
  croatie: "HR",
  hungary: "HU",
  hongrie: "HU",
  ireland: "IE",
  irlande: "IE",
  italy: "IT",
  italie: "IT",
  japan: "JP",
  japon: "JP",
  lithuania: "LT",
  lituanie: "LT",
  luxembourg: "LU",
  latvia: "LV",
  lettonie: "LV",
  malta: "MT",
  malte: "MT",
  mexico: "MX",
  mexique: "MX",
  malaysia: "MY",
  malaisie: "MY",
  netherlands: "NL",
  "pays bas": "NL",
  norway: "NO",
  norvege: "NO",
  "new zealand": "NZ",
  "nouvelle zelande": "NZ",
  poland: "PL",
  pologne: "PL",
  portugal: "PT",
  romania: "RO",
  roumanie: "RO",
  sweden: "SE",
  suede: "SE",
  singapore: "SG",
  singapour: "SG",
  slovenia: "SI",
  slovenie: "SI",
  slovakia: "SK",
  slovaquie: "SK",
  thailand: "TH",
  thailande: "TH",
  "united states": "US",
  "etats unis": "US",
  usa: "US",
  "united arab emirates": "AE",
  "emirats arabes unis": "AE",
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isoFromLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  const withoutFlag = trimmed.replace(/^[^A-Za-zÀ-ÿ]+/u, "").trim();
  if (/^[A-Za-z]{2}$/.test(withoutFlag)) return withoutFlag.toUpperCase();
  return NAME_TO_ISO[fold(withoutFlag)] ?? null;
}

export function isXofCurrency(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().toUpperCase() === "XOF";
}

export function defaultCountryForCurrency(raw: unknown): string {
  const c = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (c === "CAD") return "CA";
  if (c === "USD") return "US";
  if (c === "GBP") return "GB";
  return "FR";
}

export function pickConnectCountry(requested: unknown, profile: unknown, currency: unknown): string {
  for (const raw of [requested, profile]) {
    const cc = isoFromLabel(raw);
    if (cc && STRIPE_CONNECT_COUNTRIES.has(cc)) return cc;
  }
  return defaultCountryForCurrency(currency);
}
