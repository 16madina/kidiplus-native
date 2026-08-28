// Stripe Connect onboarding — same kidiplus.com HTTP APIs as the web seller wallet.
import { Linking } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { supabase } from "./supabase";

const API_BASE = "https://kidiplus.com";
const RETURN_URL = "kidiplus://connect-return";
const REFRESH_URL = "kidiplus://connect-refresh";
const WEB_FALLBACK = "https://kidiplus.com";

export type ConnectStatus = "none" | "pending" | "active" | "restricted";

export type ConnectState = {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  status: ConnectStatus;
  error?: string;
};

async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postJson(path: string, body: Record<string, unknown> = {}): Promise<{
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
}> {
  const token = await bearer();
  if (!token) return { ok: false, status: 401, json: { error: "not_signed_in" } };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Origin: "https://kidiplus.com",
        "X-Payments-Env": "live",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: { error: "network" } };
  }
}

function readError(json: Record<string, unknown>, fallback: string): string {
  const e = json.error ?? json.message ?? json.detail;
  return typeof e === "string" && e.trim() ? e.trim() : fallback;
}

export async function fetchConnectStatus(): Promise<ConnectState> {
  const empty: ConnectState = {
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    status: "none",
  };
  const { ok, json } = await postJson("/api/connect/status");
  if (!ok) {
    return { ...empty, error: readError(json, "Impossible de lire le statut Stripe Connect.") };
  }
  const chargesEnabled = Boolean(json.chargesEnabled ?? json.charges_enabled);
  const payoutsEnabled = Boolean(json.payoutsEnabled ?? json.payouts_enabled);
  const connected = Boolean(json.connected ?? json.accountId ?? json.account_id);
  const status: ConnectStatus =
    chargesEnabled && payoutsEnabled ? "active" : connected ? "pending" : "none";
  return { connected, chargesEnabled, payoutsEnabled, status };
}

export async function startConnectOnboarding(): Promise<{ url: string | null; error?: string }> {
  const paths = ["/api/connect/onboard", "/api/stripe/connect/onboard", "/api/connect/account-link"];
  const body = {
    returnUrl: RETURN_URL,
    refreshUrl: REFRESH_URL,
    return_url: `${API_BASE}/`,
    refresh_url: `${API_BASE}/`,
    native: true,
  };
  let lastError = "Connect not ready";
  for (const path of paths) {
    const { ok, json } = await postJson(path, body);
    const url = String(json.url ?? json.onboardingUrl ?? json.accountLink ?? json.link ?? "");
    if (ok && url.startsWith("http")) return { url };
    lastError = readError(json, lastError);
  }
  return { url: null, error: lastError };
}

export async function openConnectUrl(url: string): Promise<void> {
  if (requireOptionalNativeModule("ExpoWebBrowser")) {
    try {
      const WebBrowser = require("expo-web-browser") as typeof import("expo-web-browser");
      await WebBrowser.openAuthSessionAsync(url, RETURN_URL, { preferEphemeralSession: false });
      return;
    } catch {
      /* fall through */
    }
  }
  await Linking.openURL(url);
}

export async function openConnectWebFallback(): Promise<void> {
  await Linking.openURL(WEB_FALLBACK);
}
