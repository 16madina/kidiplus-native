// User notifications (real DB rows, same RPCs as kidiplus.com).

import { supabase } from "./supabase";

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  order_id: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchMyNotifications(
  limit = 50,
): Promise<{ rows: NotificationRow[]; unread: number }> {
  const { data, error } = await supabase.rpc("list_my_notifications", { _limit: limit } as never);
  if (error || !data) return { rows: [], unread: 0 };
  const d = data as { rows?: NotificationRow[]; unread?: number };
  return { rows: d.rows ?? [], unread: Number(d.unread ?? 0) };
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.rpc("mark_notification_read", { _id: id } as never);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.rpc("mark_all_notifications_read", {} as never);
}
