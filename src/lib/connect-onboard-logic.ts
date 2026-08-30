export type StripeBusinessType = "individual" | "company";

export const KIDI_SITE = "https://kidiplus.com";
export const CONNECT_MCC_RETAIL = "5399";
export const COMPANY_PERSON_TITLE = "Propriétaire";

/** Countries Stripe Express can host. West Africa (CI, SN, …) is not in this set. */
export const STRIPE_CONNECT_COUNTRIES = new Set([
  "AE", "AT", "AU", "BE", "BG", "BR", "CA", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GI", "GR", "HK", "HR", "HU", "IE", "IT", "JP", "LI", "LT", "LU",
  "LV", "MT", "MX", "MY", "NL", "NO", "NZ", "PL", "PT", "RO", "SE", "SG", "SI", "SK",
  "TH", "US",
]);

export function defaultCountryForCurrency(currency?: string | null): string {
  const c = (currency ?? "").trim().toUpperCase();
  if (c === "CAD") return "CA";
  if (c === "USD") return "US";
  if (c === "GBP") return "GB";
  return "FR";
}

const COUNTRY_NAME_ALIAS: Record<string, string> = {
  canada: "CA",
  france: "FR",
  usa: "US",
  "united states": "US",
  "etats unis": "US",
  "united kingdom": "GB",
  "royaume uni": "GB",
  "cote divoire": "CI",
  "ivory coast": "CI",
  senegal: "SN",
  belgique: "BE",
  belgium: "BE",
  switzerland: "CH",
  suisse: "CH",
};

export function isoCountryFromLabel(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  const withoutFlag = trimmed.replace(/^[^A-Za-zÀ-ÿ]+/u, "").trim();
  if (/^[A-Za-z]{2}$/.test(withoutFlag)) return withoutFlag.toUpperCase();
  const key = withoutFlag
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return COUNTRY_NAME_ALIAS[key] ?? null;
}

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
  if (
    code === "connect_country_unsupported" ||
    code === "connect_currency_unsupported" ||
    blob.includes("cannot create") && blob.includes("country") ||
    blob.includes("unsupported") && blob.includes("country")
  ) {
    return {
      kind: "server",
      text: "Stripe Connect n'est pas disponible pour ce pays. On ouvre un compte France / Europe — réessaie.",
    };
  }
  if (blob.includes("invalid api key") || blob.includes("invalid_api_key")) {
    return { kind: "server", text: "Clé Stripe serveur invalide. Vérifie STRIPE_LIVE_API_KEY dans Supabase." };
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

/** UI Stripe: never re-ask particular / entreprise once a Connect account exists. */
export function connectUiPhase(input: {
  payoutsEnabled?: boolean;
  connected?: boolean;
  status?: string | null;
}): "choose" | "needs_info" | "ready" {
  if (input.payoutsEnabled || input.status === "active") return "ready";
  if (input.connected || input.status === "pending" || input.status === "restricted") {
    return "needs_info";
  }
  return "choose";
}

export function stripeAccountLinkUrls(): { returnUrl: string; refreshUrl: string } {
  return {
    returnUrl: `${KIDI_SITE}/vendeur/stripe/retour`,
    refreshUrl: `${KIDI_SITE}/vendeur/stripe/refresh`,
  };
}
