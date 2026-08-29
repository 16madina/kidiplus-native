import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestPushPermission } from "./push";

const KEY = "kidi-affiche-reminders-v1";

type ReminderRow = {
  afficheId: string;
  eventAt: string;
  title: string;
  notificationId?: string;
};

async function loadRows(): Promise<ReminderRow[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReminderRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveRows(rows: ReminderRow[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(rows));
}

function loadScheduler(): typeof import("expo-notifications") | null {
  try {
    // Local date triggers do not need the push token manager.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

export async function hasAfficheReminder(afficheId: string): Promise<boolean> {
  const rows = await loadRows();
  return rows.some((r) => r.afficheId === afficheId);
}

export async function addAfficheReminder(input: {
  afficheId: string;
  eventAt: string;
  title: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: "no_date" | "past" | "denied" | "failed" }> {
  const when = new Date(input.eventAt);
  if (!Number.isFinite(when.getTime())) return { ok: false, error: "no_date" };
  if (when.getTime() <= Date.now() + 15_000) return { ok: false, error: "past" };

  const perm = await requestPushPermission();
  if (perm === "denied") return { ok: false, error: "denied" };

  const Notifications = loadScheduler();
  let notificationId: string | undefined;
  if (Notifications) {
    try {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: input.title || "KiDi+",
          body: input.body,
          data: { kind: "affiche_reminder", afficheId: input.afficheId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
        },
      });
    } catch {
      return { ok: false, error: "failed" };
    }
  }

  const rows = (await loadRows()).filter((r) => r.afficheId !== input.afficheId);
  rows.push({
    afficheId: input.afficheId,
    eventAt: when.toISOString(),
    title: input.title,
    notificationId,
  });
  await saveRows(rows);
  return { ok: true };
}

export async function removeAfficheReminder(afficheId: string): Promise<void> {
  const rows = await loadRows();
  const keep: ReminderRow[] = [];
  const Notifications = loadScheduler();
  for (const row of rows) {
    if (row.afficheId !== afficheId) {
      keep.push(row);
      continue;
    }
    if (row.notificationId && Notifications) {
      try {
        await Notifications.cancelScheduledNotificationAsync(row.notificationId);
      } catch {
        /* already fired */
      }
    }
  }
  await saveRows(keep);
}
