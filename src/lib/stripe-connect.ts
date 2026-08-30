// Stripe Connect — same /api/connect/* contract as kidiplus.com stripe-connect-client.
import { AppState, Linking } from "react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "./supabase";
import { paymentsEnvHeaders } from "./stripe-web";
import { isConnectReturnUrl } from "./payout-setup-logic";
import { normalizeCountryCode } from "./countries";
import {
  inferAccountLivemode,
  isStaleConnectAccountError,
  mapConnectOnboardError,
  parseStripeBusinessType,
  stripeAccountLinkUrls,
  type StripeBusinessType,
} from "./connect-onboard-logic";

const API_BASE = "https://kidiplus.com";
const WEB_FALLBACK = "https://kidiplus.com";

/** Native return after Stripe Express onboarding. Server should bounce here. */
export const CONNECT_RETURN_SCHEME = "kidiplus://connect-return";

export type ConnectStatus = "none" | "pending" | "active" | "restricted";

export type ConnectState = {
  ok: boolean;
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  eligible: boolean;
  connectUnavailable: boolean;
  status: ConnectStatus;
  currency: string;
  country: string;
  livemode: boolean | null;
  error?: string;
  message?: string;
};

async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postConnect(
  path: string,
  body: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const token = await bearer();
  if (!token) return { error: "unauthorized" };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Origin: "https://kidiplus.com",
        ...paymentsEnvHeaders(),
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok && !json.error) return { error: "http_error", message: `HTTP ${res.status}` };
    return json;
  } catch (e) {
    return { error: "network_error", message: e instanceof Error ? e.message : "network" };
  }
}

async function postEdgeFunction(
  name: string,
  body: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const token = await bearer();
  if (!token) return { error: "unauthorized" };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 404) return { error: "not_deployed" };
    if (!res.ok && !json.error) return { error: "http_error", message: `HTTP ${res.status}` };
    return json;
  } catch (e) {
    return { error: "network_error", message: e instanceof Error ? e.message : "network" };
  }
}

function asStatus(value: unknown): ConnectStatus {
  if (value === "active" || value === "pending" || value === "restricted" || value === "none") {
    return value;
  }
  return "none";
}

function asCountry(json: Record<string, unknown>): string {
  for (const key of ["country", "accountCountry", "connectCountry"]) {
    const v = json[key];
    if (typeof v === "string" && v.trim()) return v.trim().toUpperCase();
  }
  return "";
}

const CONNECT_CACHE_MS = 45_000;
let connectCache: { at: number; state: ConnectState } | null = null;

function emptyConnectState(): ConnectState {
  return {
    ok: false,
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    eligible: false,
    connectUnavailable: false,
    status: "none",
    currency: "EUR",
    country: "",
    livemode: null,
  };
}

async function connectStateFromProfile(): Promise<ConnectState | null> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "stripe_account_id, stripe_connect_id, connect_status, connect_payouts_enabled, stripe_payouts_enabled, connect_charges_enabled",
    )
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const accountId =
    (typeof row.stripe_connect_id === "string" && row.stripe_connect_id) ||
    (typeof row.stripe_account_id === "string" && row.stripe_account_id) ||
    "";
  const payoutsEnabled = Boolean(row.connect_payouts_enabled || row.stripe_payouts_enabled);
  const status = asStatus(row.connect_status);
  if (!accountId && status === "none" && !payoutsEnabled) return null;
  const resolved: ConnectStatus = status !== "none" ? status : payoutsEnabled ? "active" : accountId ? "pending" : "none";
  return {
    ok: true,
    connected: Boolean(accountId) || resolved !== "none",
    chargesEnabled: Boolean(row.connect_charges_enabled),
    payoutsEnabled,
    detailsSubmitted: payoutsEnabled || resolved === "active",
    eligible: true,
    connectUnavailable: false,
    status: resolved,
    currency: "EUR",
    country: "",
    livemode: payoutsEnabled || resolved === "active" ? true : null,
  };
}

export async function fetchConnectStatus(): Promise<ConnectState> {
  if (connectCache && Date.now() - connectCache.at < CONNECT_CACHE_MS) {
    return connectCache.state;
  }
  const empty = emptyConnectState();
  const edge = await postEdgeFunction("connect-status");
  const json = edge.error === "not_deployed" || edge.error === "network_error" || edge.error === "http_error"
    ? await postConnect("/api/connect/status")
    : edge;
  if (json.ok === false || json.error) {
    const message = typeof json.message === "string" ? json.message : undefined;
    if (isStaleConnectAccountError(message)) {
      connectCache = { at: Date.now(), state: { ...empty, ok: true, status: "none", livemode: null } };
      return connectCache.state;
    }
    const cached = await connectStateFromProfile();
    if (cached) {
      connectCache = { at: Date.now(), state: cached };
      return cached;
    }
    return {
      ...empty,
      error: String(json.error ?? "unknown"),
      message,
    };
  }
  const chargesEnabled = Boolean(json.chargesEnabled ?? json.charges_enabled);
  const payoutsEnabled = Boolean(json.payoutsEnabled ?? json.payouts_enabled);
  const detailsSubmitted = Boolean(json.detailsSubmitted);
  const hasAccount = Boolean(json.connected) || Boolean(json.account_id);
  const status =
    asStatus(json.status) !== "none"
      ? asStatus(json.status)
      : payoutsEnabled
        ? "active"
        : hasAccount || detailsSubmitted || chargesEnabled
          ? "pending"
          : "none";
  const rawLive = json.livemode === false ? false : json.livemode === true ? true : null;
  // Missing livemode + payouts on = live Express. Only explicit false is test.
  const livemode = inferAccountLivemode(rawLive, payoutsEnabled || status === "active" ? true : null);
  const state: ConnectState = {
    ok: true,
    connected: hasAccount || status !== "none",
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    eligible: Boolean(json.eligible),
    connectUnavailable: Boolean(json.connectUnavailable),
    status,
    currency: String(json.currency ?? "EUR"),
    country: asCountry(json),
    livemode,
  };
  connectCache = { at: Date.now(), state };
  return state;
}

function mapOnboardError(code: string | undefined, message?: string): string {
  if (code === "connect_currency_unsupported" || code === "connect_country_unsupported") {
    return "Stripe Connect n'est pas disponible pour ton pays / ta devise. Utilise PayPal ou un virement.";
  }
  if (code === "connect_not_enabled") {
    return message?.trim() || "Stripe Connect n'est pas activé sur ce compte. Réessaie ou ouvre kidiplus.com.";
  }
  return mapConnectOnboardError(code, message).text;
}

export async function startConnectOnboarding(
  country?: string | null,
  businessType?: StripeBusinessType | null,
  currency?: string | null,
): Promise<{
  url: string | null;
  error?: string;
}> {
  const type = parseStripeBusinessType(businessType);
  const links = stripeAccountLinkUrls();
  const body: Record<string, unknown> = {
    native: true,
    businessType: type,
    returnUrl: links.returnUrl,
    refreshUrl: links.refreshUrl,
  };
  const iso = normalizeCountryCode(country) ?? country?.trim().toUpperCase();
  if (iso && /^[A-Z]{2}$/.test(iso)) body.country = iso;
  if (currency && currency.trim()) body.currency = currency.trim().toUpperCase();

  const edge = await postEdgeFunction("connect-onboard", body);
  const json =
    edge.error === "not_deployed" || edge.error === "network_error"
      ? await postConnect("/api/connect/onboard", body)
      : edge;
  const url = typeof json.url === "string" ? json.url : "";
  if (url.startsWith("http")) return { url };
  return {
    url: null,
    error: mapOnboardError(
      typeof json.error === "string" ? json.error : undefined,
      typeof json.message === "string" ? json.message : undefined,
    ),
  };
}

export async function startConnectLoginLink(): Promise<{ url: string | null; error?: string }> {
  const edge = await postEdgeFunction("connect-dashboard-link");
  const json =
    edge.error === "not_deployed" || edge.error === "network_error"
      ? await postConnect("/api/connect/login-link")
      : edge;
  const url = typeof json.url === "string" ? json.url : "";
  if (url.startsWith("http")) return { url };
  return {
    url: null,
    error: mapOnboardError(
      typeof json.error === "string" ? json.error : undefined,
      typeof json.message === "string" ? json.message : undefined,
    ),
  };
}

export async function dispatchConnectPayout(payoutId: string): Promise<{
  ok: boolean;
  refunded?: boolean;
  error?: string;
}> {
  // Never fall back to kidiplus.com /api/connect/payout: that route uses a
  // different Stripe platform key, so Transfer fails with "No such destination"
  // and leaves the payout row locked (no refund).
  const json = await postEdgeFunction("connect-payout", { payoutId });
  if (json.ok && !json.refunded) return { ok: true };
  if (!json.ok && json.refunded !== true) {
    const refund = await postEdgeFunction("connect-payout", { payoutId, refund: true });
    if (refund.ok || refund.refunded) {
      return { ok: false, refunded: true, error: typeof json.error === "string" ? json.error : "transfer_failed" };
    }
  }
  return {
    ok: false,
    refunded: json.refunded === true,
    error: typeof json.error === "string" ? json.error : String(json.message ?? "transfer_failed"),
  };
}

/** Safari / Chrome — never an in-app WebView (Stripe / Google block those). */
export async function openConnectUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}

export async function openConnectWebFallback(): Promise<void> {
  await Linking.openURL(WEB_FALLBACK);
}

/** Deep link `kidiplus://connect-return` + app resume after Safari. */
export function subscribeConnectReturn(onReturn: () => void): () => void {
  let last = 0;
  const fire = () => {
    const now = Date.now();
    if (now - last < 800) return;
    last = now;
    onReturn();
  };

  const linkSub = Linking.addEventListener("url", ({ url }) => {
    if (isConnectReturnUrl(url)) fire();
  });
  void Linking.getInitialURL().then((url) => {
    if (isConnectReturnUrl(url)) fire();
  });
  const appSub = AppState.addEventListener("change", (s) => {
    if (s === "active") fire();
  });

  return () => {
    linkSub.remove();
    appSub.remove();
  };
}
