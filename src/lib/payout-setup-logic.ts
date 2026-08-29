import type { PayoutMethod } from "./earnings";

/** Saved seller payout destinations — shared by Profil and the withdraw sheet. */
export type PayoutSetup = {
  paypalEmail: string;
  wavePhone: string;
  waveHolder: string;
  orangeMoneyPhone: string;
  orangeMoneyHolder: string;
  bankIban: string;
  bankHolder: string;
};

export function emptyPayoutSetup(): PayoutSetup {
  return {
    paypalEmail: "",
    wavePhone: "",
    waveHolder: "",
    orangeMoneyPhone: "",
    orangeMoneyHolder: "",
    bankIban: "",
    bankHolder: "",
  };
}

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parsePayoutSetup(raw: unknown): PayoutSetup {
  const empty = emptyPayoutSetup();
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  return {
    paypalEmail: asTrimmed(o.paypalEmail).toLowerCase(),
    wavePhone: asTrimmed(o.wavePhone),
    waveHolder: asTrimmed(o.waveHolder),
    orangeMoneyPhone: asTrimmed(o.orangeMoneyPhone),
    orangeMoneyHolder: asTrimmed(o.orangeMoneyHolder),
    bankIban: asTrimmed(o.bankIban).toUpperCase().replace(/\s+/g, ""),
    bankHolder: asTrimmed(o.bankHolder),
  };
}

export function payoutSetupHasAny(setup: PayoutSetup): boolean {
  return Boolean(
    setup.paypalEmail || setup.wavePhone || setup.orangeMoneyPhone || setup.bankIban,
  );
}

export function isValidPaypalEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPayoutPhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 8;
}

/** Loose IBAN check: country + check digits + BBAN. Does not compute the checksum. */
export function isValidIban(iban: string): boolean {
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(compact);
}

export function isStripePayoutReady(status: string | null | undefined): boolean {
  return status === "active";
}

export function payoutMethodReady(
  method: PayoutMethod,
  setup: PayoutSetup,
  stripeReady: boolean,
): boolean {
  switch (method) {
    case "stripe_connect":
      return stripeReady;
    case "paypal":
      return isValidPaypalEmail(setup.paypalEmail);
    case "wave":
      return isValidPayoutPhone(setup.wavePhone);
    case "orange_money":
      return isValidPayoutPhone(setup.orangeMoneyPhone);
    case "bank_transfer":
      return isValidIban(setup.bankIban);
    default:
      return false;
  }
}

export function anyPayoutMethodReady(
  methods: readonly PayoutMethod[],
  setup: PayoutSetup,
  stripeReady: boolean,
): boolean {
  return methods.some((m) => payoutMethodReady(m, setup, stripeReady));
}

export function firstReadyPayoutMethod(
  methods: readonly PayoutMethod[],
  setup: PayoutSetup,
  stripeReady: boolean,
): PayoutMethod | null {
  return methods.find((m) => payoutMethodReady(m, setup, stripeReady)) ?? null;
}

export function destinationFromSetup(
  method: PayoutMethod,
  setup: PayoutSetup,
): Record<string, string> {
  if (method === "wave") {
    const dest: Record<string, string> = { phone: setup.wavePhone };
    if (setup.waveHolder) dest.holder = setup.waveHolder;
    return dest;
  }
  if (method === "orange_money") {
    const dest: Record<string, string> = { phone: setup.orangeMoneyPhone };
    if (setup.orangeMoneyHolder) dest.holder = setup.orangeMoneyHolder;
    return dest;
  }
  if (method === "paypal") return { paypalEmail: setup.paypalEmail };
  if (method === "bank_transfer") {
    const dest: Record<string, string> = { iban: setup.bankIban };
    if (setup.bankHolder) dest.holder = setup.bankHolder;
    return dest;
  }
  return {};
}

export function applyDestinationToSetup(
  setup: PayoutSetup,
  method: PayoutMethod,
  dest: { phone?: string; holder?: string; paypalEmail?: string; iban?: string },
): PayoutSetup {
  const next = { ...setup };
  if (method === "wave") {
    if (dest.phone != null) next.wavePhone = dest.phone.trim();
    if (dest.holder != null) next.waveHolder = dest.holder.trim();
  } else if (method === "orange_money") {
    if (dest.phone != null) next.orangeMoneyPhone = dest.phone.trim();
    if (dest.holder != null) next.orangeMoneyHolder = dest.holder.trim();
  } else if (method === "paypal") {
    if (dest.paypalEmail != null) next.paypalEmail = dest.paypalEmail.trim().toLowerCase();
  } else if (method === "bank_transfer") {
    if (dest.iban != null) next.bankIban = dest.iban.replace(/\s+/g, "").toUpperCase();
    if (dest.holder != null) next.bankHolder = dest.holder.trim();
  }
  return parsePayoutSetup(next);
}
