import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

export type PushStatus = "unknown" | "granted" | "denied" | "prompt";

const PREPROMPT_KEY = "push:preprompt_shown";
const LAST_TOKEN_KEY = "push:last_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function platform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

export async function getPushPermissionStatus(): Promise<PushStatus> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return "granted";
    if (cur.status === "denied") return "denied";
    if (cur.canAskAgain === false) return "denied";
    return "prompt";
  } catch {
    return "unknown";
  }
}

export async function requestPushPermission(): Promise<PushStatus> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "KiDi+",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (res.granted) return "granted";
    if (res.status === "denied" || res.canAskAgain === false) return "denied";
    return "prompt";
  } catch {
    return "unknown";
  }
}

export async function wasPrepromptShown(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREPROMPT_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markPrepromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(PREPROMPT_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Device push token (FCM on Android when google-services is set; APNs/FCM on iOS). */
export async function getDevicePushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    const value = typeof token?.data === "string" ? token.data.trim() : "";
    return value || null;
  } catch {
    return null;
  }
}

export async function persistDeviceToken(userId: string, token: string): Promise<boolean> {
  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: platform(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) return false;
  try {
    await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  return true;
}

export async function unregisterDeviceToken(userId: string): Promise<void> {
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(LAST_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (token) {
    await supabase.from("device_tokens").delete().eq("user_id", userId).eq("token", token);
  } else {
    await supabase.from("device_tokens").delete().eq("user_id", userId);
  }
  try {
    await AsyncStorage.removeItem(LAST_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Request permission (if needed) and persist token for the signed-in user. */
export async function registerForPush(userId: string): Promise<{
  status: PushStatus;
  token: string | null;
}> {
  let status = await getPushPermissionStatus();
  if (status === "prompt" || status === "unknown") {
    status = await requestPushPermission();
  }
  if (status !== "granted") return { status, token: null };
  const token = await getDevicePushToken();
  if (token) await persistDeviceToken(userId, token);
  return { status, token };
}

export type PushOpenPayload = {
  kind?: string;
  order_id?: string;
  live_id?: string;
  seller_handle?: string;
  seller_id?: string;
  thread_id?: string;
  post_id?: string;
  [key: string]: unknown;
};

export function normalizePushData(raw: unknown): PushOpenPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const out: PushOpenPayload = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  if (!out.kind && typeof out["notification.kind"] === "string") {
    out.kind = String(out["notification.kind"]);
  }
  return out;
}

export function payloadFromNotificationResponse(
  response: Notifications.NotificationResponse,
): PushOpenPayload | null {
  const content = response.notification.request.content;
  const data = normalizePushData(content.data);
  if (data) return data;
  // Fallback: title/body only → open activity inbox.
  return { kind: "notif" };
}
