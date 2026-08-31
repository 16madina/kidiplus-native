// Shared HTTP + in-app browser for kidiplus.com APIs (same session as the site).

import { Linking } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { supabase } from "./supabase";

export const KIDIPLUS_API = "https://kidiplus.com";

type WebBrowserModule = typeof import("expo-web-browser");

let webBrowserCached: WebBrowserModule | null | undefined;

function loadWebBrowser(): WebBrowserModule | null {
  if (webBrowserCached !== undefined) return webBrowserCached;
  if (!requireOptionalNativeModule("ExpoWebBrowser")) {
    webBrowserCached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    webBrowserCached = require("expo-web-browser") as WebBrowserModule;
    try {
      webBrowserCached.maybeCompleteAuthSession();
    } catch {
      /* ignore */
    }
  } catch {
    webBrowserCached = null;
  }
  return webBrowserCached;
}

export async function kidiplusBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function kidiplusAuthHeaders(): Promise<Record<string, string>> {
  const token = await kidiplusBearer();
  if (!token) throw new Error("signed_out");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Origin: KIDIPLUS_API,
  };
}

export async function kidiplusJson<T>(
  path: string,
  init?: { method?: string; body?: Record<string, unknown> },
): Promise<{ ok: boolean; status: number; error?: string; data: T }> {
  const headers = await kidiplusAuthHeaders();
  const res = await fetch(`${KIDIPLUS_API}${path}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  const rec = data as { error?: string; message?: string; ok?: boolean };
  if (!res.ok || rec.ok === false) {
    return {
      ok: false,
      status: res.status,
      error: rec.message || rec.error || `http_${res.status}`,
      data,
    };
  }
  return { ok: true, status: res.status, data };
}

/** Open Google / Meta OAuth and bounce back via `kidiplus://…`. */
export async function openKidiplusOAuth(url: string, redirectUrl: string): Promise<"ok" | "cancel" | "opened"> {
  const browser = loadWebBrowser();
  if (browser?.openAuthSessionAsync) {
    const result = await browser.openAuthSessionAsync(url, redirectUrl);
    if (result.type === "success") return "ok";
    if (result.type === "cancel" || result.type === "dismiss") return "cancel";
    return "opened";
  }
  const opened = await Linking.openURL(url);
  return opened ? "opened" : "cancel";
}
