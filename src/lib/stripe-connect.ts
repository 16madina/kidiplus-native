// Stripe Connect — same /api/connect/* contract as kidiplus.com stripe-connect-client.
import { AppState, Linking } from "react-native";
import { supabase } from "./supabase";
import { paymentsEnvHeaders } from "./stripe-web";
import { isConnectReturnUrl } from "./payout-setup-logic";

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

export async function fetchConnectStatus(): Promise<ConnectState> {
  const empty: ConnectState = {
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
  };
  const json = await postConnect("/api/connect/status");
  if (json.ok === false || json.error) {
    return {
      ...empty,
      error: String(json.error ?? "unknown"),
      message: typeof json.message === "string" ? json.message : undefined,
    };
  }
  const chargesEnabled = Boolean(json.chargesEnabled);
  const payoutsEnabled = Boolean(json.payoutsEnabled);
  const detailsSubmitted = Boolean(json.detailsSubmitted);
  const status =
    asStatus(json.status) !== "none"
      ? asStatus(json.status)
      : chargesEnabled && payoutsEnabled
        ? "active"
        : detailsSubmitted
          ? "pending"
          : "none";
  return {
    ok: true,
    connected: status !== "none",
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    eligible: Boolean(json.eligible),
    connectUnavailable: Boolean(json.connectUnavailable),
    status,
    currency: String(json.currency ?? "EUR"),
    country: asCountry(json),
  };
}

function mapOnboardError(code: string | undefined, message?: string): string {
  if (code === "connect_currency_unsupported" || code === "connect_country_unsupported") {
    return "Stripe Connect n'est pas disponible pour ton pays / ta devise. Utilise PayPal ou un virement.";
  }
  if (code === "connect_not_enabled") {
    return message?.trim() || "Stripe Connect n'est pas activé sur ce compte. Réessaie ou ouvre kidiplus.com.";
  }
  if (message?.trim()) return message.trim();
  if (code && code !== "unknown") return code;
  return "Impossible d'ouvrir l'onboarding Stripe. Réessaie.";
}

export async function startConnectOnboarding(country?: string | null): Promise<{
  url: string | null;
  error?: string;
}> {
  const body: Record<string, unknown> = {
    native: true,
    returnUrl: CONNECT_RETURN_SCHEME,
    refreshUrl: CONNECT_RETURN_SCHEME,
  };
  if (country && country.trim()) body.country = country.trim().toUpperCase();
  const json = await postConnect("/api/connect/onboard", body);
  const url = typeof json.url === "string" ? json.url : "";
  if (json.ok && url.startsWith("http")) return { url };
  return {
    url: null,
    error: mapOnboardError(
      typeof json.error === "string" ? json.error : undefined,
      typeof json.message === "string" ? json.message : undefined,
    ),
  };
}

export async function startConnectLoginLink(): Promise<{ url: string | null; error?: string }> {
  const json = await postConnect("/api/connect/login-link");
  const url = typeof json.url === "string" ? json.url : "";
  if (json.ok && url.startsWith("http")) return { url };
  return {
    url: null,
    error: mapOnboardError(
      typeof json.error === "string" ? json.error : undefined,
      typeof json.message === "string" ? json.message : undefined,
    ),
  };
}

export async function dispatchConnectPayout(payoutId: string): Promise<{ ok: boolean; error?: string }> {
  const json = await postConnect("/api/connect/payout", { payoutId });
  if (json.ok) return { ok: true };
  return {
    ok: false,
    error: typeof json.message === "string" ? json.message : String(json.error ?? "transfer_failed"),
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
