import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo-modules-core";
import { supabase } from "./supabase";

export type PushStatus = "unknown" | "granted" | "denied" | "prompt" | "unavailable";

const PREPROMPT_KEY = "push:preprompt_shown";
const LAST_TOKEN_KEY = "push:last_token";

type NotificationsModule = typeof import("expo-notifications");

let cached: NotificationsModule | null | undefined;
let handlerReady = false;

/**
 * Gate on the native module before requiring JS — try/catch alone still
 * redboxes when ExpoPushTokenManager is missing from the binary.
 */
function loadNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (!requireOptionalNativeModule("ExpoPushTokenManager")) {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require("expo-notifications") as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function pushNativeAvailable(): boolean {
  return loadNotifications() !== null;
}

function ensureHandler(Notifications: NotificationsModule) {
  if (handlerReady) return;
  handlerReady = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    /* native module missing in this binary */
  }
}

function platform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

export async function getPushPermissionStatus(): Promise<PushStatus> {
  const Notifications = loadNotifications();
  if (!Notifications) return "unavailable";
  try {
    ensureHandler(Notifications);
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return "granted";
    if (cur.status === "denied") return "denied";
    if (cur.canAskAgain === false) return "denied";
    return "prompt";
  } catch {
    return "unavailable";
  }
}

export async function requestPushPermission(): Promise<PushStatus> {
  const Notifications = loadNotifications();
  if (!Notifications) return "unavailable";
  try {
    ensureHandler(Notifications);
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
    return "unavailable";
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
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    ensureHandler(Notifications);
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
  if (status === "unavailable") return { status, token: null };
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

export function payloadFromNotificationData(data: unknown): PushOpenPayload | null {
  const normalized = normalizePushData(data);
  if (normalized) return normalized;
  return { kind: "notif" };
}

type Subscription = { remove: () => void };

/** Subscribe to notification taps. No-op when native module is missing. */
export function subscribeNotificationResponses(
  onResponse: (payload: PushOpenPayload | null, id: string) => void,
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => undefined;
  ensureHandler(Notifications);
  const subs: Subscription[] = [];
  try {
    subs.push(
      Notifications.addNotificationResponseReceivedListener((response) => {
        const id = response.notification.request.identifier;
        const data = response.notification.request.content.data;
        onResponse(payloadFromNotificationData(data), id);
      }),
    );
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      const data = response.notification.request.content.data;
      onResponse(payloadFromNotificationData(data), id);
    });
    subs.push(Notifications.addNotificationReceivedListener(() => undefined));
  } catch {
    return () => undefined;
  }
  return () => {
    for (const s of subs) s.remove();
  };
}
