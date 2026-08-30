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
    paypalEmail: asTrimmed(o.paypalEmail ?? o.payout_paypal_email).toLowerCase(),
    wavePhone: asTrimmed(o.wavePhone ?? o.payout_wave_phone),
    waveHolder: asTrimmed(o.waveHolder),
    orangeMoneyPhone: asTrimmed(o.orangeMoneyPhone ?? o.payout_om_phone),
    orangeMoneyHolder: asTrimmed(o.orangeMoneyHolder),
    bankIban: asTrimmed(o.bankIban ?? o.payout_bank_iban).toUpperCase().replace(/\s+/g, ""),
    bankHolder: asTrimmed(o.bankHolder ?? o.payout_bank_holder),
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

/** E.164-ish: leading + and at least 8 digits. */
export function isValidPayoutPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed.startsWith("+")) return false;
  return trimmed.replace(/\D/g, "").length >= 8;
}

/** IBAN: at least 15 characters after stripping spaces. Checksum is not verified. */
export function isValidIban(iban: string): boolean {
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  return compact.length >= 15 && /^[A-Z]{2}[0-9A-Z]+$/.test(compact);
}

export function isValidBankHolder(holder: string): boolean {
  return holder.trim().length >= 2;
}

export function isStripePayoutReady(
  status: string | null | undefined,
  livemode: boolean | null | undefined = undefined,
  payoutsEnabled?: boolean,
): boolean {
  if (livemode === false) return false;
  return status === "active" || payoutsEnabled === true;
}

/** RPC / Edge error codes → i18n key under `payout.errors`. */
export function payoutErrorI18nKey(code: string | null | undefined): string {
  switch ((code ?? "").trim()) {
    case "connect_not_ready":
      return "payout.errors.connectNotReady";
    case "connect_test_mode":
      return "payout.errors.connectTestMode";
    case "connect_currency_unsupported":
      return "payout.errors.connectCurrency";
    case "insufficient_funds":
      return "payout.errors.insufficient";
    case "platform_funds":
      return "payout.errors.platformFunds";
    case "payout_daily_limit":
      return "risk.errors.payoutDailyLimit";
    case "payout_weekly_limit":
      return "risk.errors.payoutWeeklyLimit";
    case "risk_restricted":
      return "risk.errors.restricted";
    case "invalid_email":
      return "payout.errors.invalidEmail";
    default:
      return "payout.errors.generic";
  }
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
      return isValidIban(setup.bankIban) && isValidBankHolder(setup.bankHolder);
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

export function payoutSetupToProfilePatch(setup: PayoutSetup): Record<string, string> {
  const next = parsePayoutSetup(setup);
  return {
    payout_paypal_email: next.paypalEmail,
    payout_wave_phone: next.wavePhone,
    payout_om_phone: next.orangeMoneyPhone,
    payout_bank_iban: next.bankIban,
    payout_bank_holder: next.bankHolder,
  };
}

/** maria@gmail.com → m•••a@gmail.com */
export function maskPaypalEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at < 1) return "•••";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const first = local[0] ?? "";
  const last = local.length > 1 ? local[local.length - 1] : "";
  return `${first}•••${last}@${domain}`;
}

/** +2250700004523 → +225 •••• 4523 */
export function maskPayoutPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  const last4 = digits.slice(-4);
  const plus = trimmed.startsWith("+");
  let cc = digits.slice(0, Math.max(1, digits.length - 4));
  if (digits.startsWith("225")) cc = "225";
  else if (digits.startsWith("1") && digits.length >= 11) cc = "1";
  else cc = digits.slice(0, Math.min(3, cc.length));
  return `${plus ? "+" : ""}${cc} •••• ${last4}`;
}

/** FR76…4589 → •••• 4589 */
export function maskIban(iban: string): string {
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 4) return "••••";
  return `•••• ${compact.slice(-4)}`;
}

export function formatConnectCountry(
  country: string | null | undefined,
  locale = "fr",
): string {
  const code = (country ?? "").trim().toUpperCase();
  if (!code || code.length !== 2) return code;
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(code);
    return name || code;
  } catch {
    return code;
  }
}

export function isConnectReturnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("kidiplus://connect-return") || /connect-return/i.test(url);
}
