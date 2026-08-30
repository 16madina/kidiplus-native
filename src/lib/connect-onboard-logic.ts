export type StripeBusinessType = "individual" | "company";

export const KIDI_SITE = "https://kidiplus.com";
export const CONNECT_MCC_RETAIL = "5399";
export const COMPANY_PERSON_TITLE = "Propriétaire";

/**
 * Stripe Express connected-account countries (platform can create Express
 * for these). West-Africa CFA (CI, SN, …) is intentionally absent.
 * Gate is currency === XOF, not GPS / vacation location.
 */
export const STRIPE_CONNECT_COUNTRIES = new Set([
  "AE", "AT", "AU", "BE", "BG", "BR", "CA", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GI", "GR", "HK", "HR", "HU", "IE", "IT", "JP", "LI", "LT", "LU",
  "LV", "MT", "MX", "MY", "NL", "NO", "NZ", "PL", "PT", "RO", "SE", "SG", "SI", "SK",
  "TH", "US",
]);

export function stripeConnectAvailable(currency?: string | null): boolean {
  return (currency ?? "").trim().toUpperCase() !== "XOF";
}

export function defaultCountryForCurrency(currency?: string | null): string {
  const c = (currency ?? "").trim().toUpperCase();
  if (c === "CAD") return "CA";
  if (c === "USD") return "US";
  if (c === "GBP") return "GB";
  return "FR";
}

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
  germany: "DE",
  allemagne: "DE",
  denmark: "DK",
  danemark: "DK",
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
  luxembourg: "LU",
  mexico: "MX",
  mexique: "MX",
  netherlands: "NL",
  "pays bas": "NL",
  norway: "NO",
  norvege: "NO",
  "new zealand": "NZ",
  "nouvelle zelande": "NZ",
  poland: "PL",
  pologne: "PL",
  portugal: "PT",
  sweden: "SE",
  suede: "SE",
  singapore: "SG",
  singapour: "SG",
  thailand: "TH",
  thailande: "TH",
  "united states": "US",
  "etats unis": "US",
  usa: "US",
};

function foldCountryName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isoCountryFromLabel(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  const withoutFlag = trimmed.replace(/^[^A-Za-zÀ-ÿ]+/u, "").trim();
  if (/^[A-Za-z]{2}$/.test(withoutFlag)) return withoutFlag.toUpperCase();
  return NAME_TO_ISO[foldCountryName(withoutFlag)] ?? null;
}

/** Prefer the seller's registered country when Stripe supports it; else the wallet currency. */
export function pickStripeConnectCountry(
  requested?: string | null,
  profileCountry?: string | null,
  currency?: string | null,
): string {
  for (const raw of [requested, profileCountry]) {
    const cc = isoCountryFromLabel(raw);
    if (cc && STRIPE_CONNECT_COUNTRIES.has(cc)) return cc;
  }
  return defaultCountryForCurrency(currency);
}

export function parseStripeBusinessType(raw: unknown): StripeBusinessType {
  return raw === "company" ? "company" : "individual";
}

export function kidiStoreUrl(handle: string | null | undefined): string | null {
  const h = (handle ?? "").trim().replace(/^@/, "");
  if (!h) return null;
  return `${KIDI_SITE}/@${h}`;
}

export function splitDisplayName(name: string | null | undefined): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function buildConnectProductDescription(input: {
  category?: string | null;
  displayName?: string | null;
}): string {
  const cat = input.category?.trim();
  const nom = input.displayName?.trim() || "Ce vendeur";
  return cat
    ? `${nom} vend des produits de la catégorie ${cat} en direct sur la marketplace KiDi+.`
    : `${nom} vend des produits en direct sur la marketplace KiDi+ (live shopping).`;
}

export function isStaleConnectAccountError(message?: string | null): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("not connected to your platform") ||
    m.includes("no such account") ||
    m.includes("resource_missing") ||
    (m.includes("account") && m.includes("does not exist"))
  );
}

export function mapConnectOnboardError(
  code: string | null | undefined,
  message?: string | null,
): { kind: "handle_missing" | "server" | "generic"; text: string } {
  if (code === "handle_missing") {
    return {
      kind: "handle_missing",
      text: "Choisis le nom de ta boutique avant de connecter ton compte de paiement.",
    };
  }
  if (isStaleConnectAccountError(message) || code === "stale_account") {
    return {
      kind: "server",
      text: "L'ancien compte Stripe n'est plus valide. Réessaie : on va en créer un nouveau.",
    };
  }
  const blob = `${code ?? ""} ${message ?? ""}`.toLowerCase();
  if (code === "connect_currency_unsupported" || blob.includes("xof") && blob.includes("connect")) {
    return {
      kind: "server",
      text: "Stripe Connect n'est pas disponible en FCFA. Utilise Wave, Orange Money, PayPal ou un virement.",
    };
  }
  if (
    code === "connect_country_unsupported" ||
    (blob.includes("cannot create") && blob.includes("country")) ||
    (blob.includes("unsupported") && blob.includes("country"))
  ) {
    return {
      kind: "server",
      text: "Stripe Connect n'est pas disponible pour ce pays. On ouvre un compte selon ta devise — réessaie.",
    };
  }
  if (blob.includes("invalid api key") || blob.includes("invalid_api_key")) {
    return { kind: "server", text: "Clé Stripe serveur invalide. Vérifie STRIPE_SECRET_KEY dans Supabase." };
  }
  if (blob.includes("managing losses") || blob.includes("platform-profile") || blob.includes("platform profile")) {
    return {
      kind: "server",
      text: "À faire une fois dans Stripe (compte KiDi+, pas le tien) : dashboard.stripe.com/settings/connect/platform-profile — accepte les responsabilités Connect, puis réessaie.",
    };
  }
  if (code === "server_error" || code === "http_error" || code === "network_error") {
    const hint = (message ?? "").replace(/^Error:\s*/i, "").replace(/^Stripe\w*Error:\s*/i, "").trim();
    if (hint.length > 12 && !/^error$/i.test(hint)) {
      return { kind: "server", text: `Stripe : ${hint.slice(0, 180)}` };
    }
    return { kind: "server", text: "Impossible de préparer Stripe. Réessaie." };
  }
  if (message?.trim() && !/^error:/i.test(message.trim())) {
    return { kind: "server", text: message.trim() };
  }
  return { kind: "generic", text: "Impossible d'ouvrir l'onboarding Stripe. Réessaie." };
}

export function connectStatusFromFlags(input: {
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  currentlyDue?: unknown;
}): "ready" | "needs_info" | "none" {
  if (input.payoutsEnabled) return "ready";
  const due = Array.isArray(input.currentlyDue) ? input.currentlyDue : [];
  if (input.chargesEnabled || due.length > 0) return "needs_info";
  return "none";
}

/**
 * Same rules as kidiplus.com `statusFromAccount`, plus: a test Express
 * account is never `active` for live seller_balances.
 */
export function connectStatusFromAccount(acc: {
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  livemode?: boolean | null;
  requirements?: {
    disabled_reason?: string | null;
    currently_due?: string[] | null;
    past_due?: string[] | null;
  } | null;
}): "none" | "pending" | "active" | "restricted" {
  const currentlyDue = acc.requirements?.currently_due ?? [];
  const pastDue = acc.requirements?.past_due ?? [];
  let status: "pending" | "active" | "restricted" = "pending";
  if (acc.payouts_enabled) status = "active";
  else if (acc.details_submitted && currentlyDue.length === 0 && pastDue.length === 0) {
    status = "active";
  } else if (pastDue.length > 0 || acc.requirements?.disabled_reason) {
    status = "restricted";
  }
  if (acc.livemode !== true && status === "active") return "pending";
  return status;
}

/** UI Stripe: never re-ask particular / entreprise once a Connect account exists. */
export function connectUiPhase(input: {
  payoutsEnabled?: boolean;
  connected?: boolean;
  status?: string | null;
  livemode?: boolean | null;
}): "choose" | "needs_info" | "ready" | "test" {
  if (
    input.livemode === false &&
    (input.payoutsEnabled || input.status === "active")
  ) {
    return "test";
  }
  if (input.payoutsEnabled || input.status === "active") return "ready";
  if (input.connected || input.status === "pending" || input.status === "restricted") {
    return "needs_info";
  }
  return "choose";
}

export const CONNECT_BOUNCE_URL =
  "https://djwuvxpmvrwfjwjamjno.supabase.co/functions/v1/connect-bounce";

export function stripeAccountLinkUrls(): { returnUrl: string; refreshUrl: string } {
  return {
    returnUrl: `${CONNECT_BOUNCE_URL}?next=return`,
    refreshUrl: `${CONNECT_BOUNCE_URL}?next=refresh`,
  };
}
