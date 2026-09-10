import { Platform } from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

// Public OAuth client ID of type Web. Google uses it as the ID-token audience
// that Supabase validates; it is not a secret.
const GOOGLE_WEB_CLIENT_ID =
  "788559297564-esapjch5rfre5pe9rg0ocr72nb5dh5v3.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "788559297564-btr1tkucm4av1k2drq3joren1ejhn62r.apps.googleusercontent.com";

// Shared with the existing KiDi+ OAuth allow-list for non-iOS platforms.
const GOOGLE_REDIRECT_URI = "kidiplus://auth-callback";

WebBrowser.maybeCompleteAuthSession();

type ErrorWithCode = { code?: unknown };

export function isGoogleAuthCancellation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as ErrorWithCode).code;
  return code === "GOOGLE_AUTH_CANCELED" || code === statusCodes.SIGN_IN_CANCELLED;
}

function canceledError() {
  const error = new Error("Google authentication canceled") as Error & { code: string };
  error.code = "GOOGLE_AUTH_CANCELED";
  return error;
}

function callbackParameters(callbackUrl: string) {
  const parsed = new URL(callbackUrl);
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
  if (hash) {
    new URLSearchParams(hash).forEach((value, key) => params.set(key, value));
  }
  return params;
}

async function finishSupabaseCallback(callbackUrl: string) {
  const params = callbackParameters(callbackUrl);
  const providerError = params.get("error_description") ?? params.get("error");
  if (providerError) throw new Error(providerError);

  const code = params.get("code");
  if (code) {
    console.info("[auth/google] exchanging OAuth code with Supabase");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.user) throw new Error("google_user_missing");
    console.info("[auth/google] Supabase session established");
    return data.user;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) throw new Error("google_tokens_missing");

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error("google_user_missing");
  console.info("[auth/google] Supabase session established");
  return data.user;
}

async function signInWithGoogleNative() {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });

  console.info("[auth/google] opening native Google Sign-In");
  // GoogleSignIn's iOS SDK always places a nonce in its ID token. Give it a
  // digest we control so Supabase can validate that claim with the raw value.
  const rawNonce = Crypto.randomUUID();
  const nonceDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const credential = await GoogleSignin.signIn({ nonce: nonceDigest });
  if (credential.type === "cancelled") throw canceledError();
  if (!credential.data.idToken) throw new Error("google_identity_token_missing");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential.data.idToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  if (!data.user) throw new Error("google_user_missing");
  console.info("[auth/google] native Supabase session established");
  return data.user;
}

async function signInWithGoogleWebOAuth() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: GOOGLE_REDIRECT_URI,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("google_authorization_url_missing");

  console.info("[auth/google] opening browser authentication session");
  const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URI);
  console.info(`[auth/google] authentication session result=${result.type}`);
  if (result.type !== "success") throw canceledError();
  return finishSupabaseCallback(result.url);
}

/** Use Google's native iOS sheet, then exchange its ID token with Supabase. */
export async function signInWithGoogle() {
  if (Platform.OS === "ios") return signInWithGoogleNative();
  return signInWithGoogleWebOAuth();
}
