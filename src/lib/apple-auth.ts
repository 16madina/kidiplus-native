import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";

type ErrorWithCode = { code?: unknown };

export function isAppleAuthCancellation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ErrorWithCode).code === "ERR_REQUEST_CANCELED"
  );
}

export async function isNativeAppleAuthAvailable(): Promise<boolean> {
  return Platform.OS === "ios" && AppleAuthentication.isAvailableAsync();
}

function nameMetadata(credential: AppleAuthentication.AppleAuthenticationCredential) {
  const firstName = credential.fullName?.givenName?.trim() ?? "";
  const lastName = credential.fullName?.familyName?.trim() ?? "";
  const displayName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim()
    : "";

  return {
    ...(displayName ? { display_name: displayName, full_name: displayName } : {}),
    ...(firstName ? { first_name: firstName } : {}),
    ...(lastName ? { last_name: lastName } : {}),
  };
}

/** Authenticate with Apple's native sheet, then exchange the ID token with Supabase. */
export async function signInWithAppleNative() {
  if (!(await isNativeAppleAuthAvailable())) {
    throw new Error("apple_auth_unavailable");
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) throw new Error("apple_identity_token_missing");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
    ...(credential.authorizationCode ? { access_token: credential.authorizationCode } : {}),
  });
  if (error) throw error;
  if (!data.user) throw new Error("apple_user_missing");

  // Apple only returns the name on the first authorization. Persist it immediately.
  const metadata = {
    apple_user_id: credential.user,
    ...nameMetadata(credential),
  };
  await supabase.auth.updateUser({ data: metadata });

  const { full_name: _fullName, ...profileMetadata } = nameMetadata(credential);
  if (Object.keys(profileMetadata).length > 0) {
    await supabase.from("profiles").update(profileMetadata).eq("id", data.user.id);
  }

  return data.user;
}

/** Obtain a fresh, one-time Apple authorization code immediately before account deletion. */
export async function getAppleRevokeAuthorizationCode(appleUserId?: string | null) {
  if (!(await isNativeAppleAuthAvailable())) throw new Error("apple_auth_unavailable");

  let credential: AppleAuthentication.AppleAuthenticationCredential | null = null;
  if (appleUserId) {
    try {
      credential = await AppleAuthentication.refreshAsync({ user: appleUserId });
    } catch (error) {
      if (isAppleAuthCancellation(error)) throw error;
    }
  }

  if (!credential?.authorizationCode) {
    credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
  }
  if (!credential.authorizationCode) throw new Error("apple_authorization_code_missing");

  return {
    authorizationCode: credential.authorizationCode,
    appleUserId: credential.user,
  };
}
