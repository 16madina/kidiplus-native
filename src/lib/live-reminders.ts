// Buyer "Me rappeler" for scheduled lives — same `live_reminders` table as kidiplus.com.
import { supabase } from "./supabase";

export async function addLiveReminder(userId: string, liveId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("live_reminders")
    .upsert({ user_id: userId, live_id: liveId }, { onConflict: "user_id,live_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeLiveReminder(userId: string, liveId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("live_reminders")
    .delete()
    .eq("user_id", userId)
    .eq("live_id", liveId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function hasLiveReminder(userId: string, liveId: string): Promise<boolean> {
  const { data } = await supabase
    .from("live_reminders")
    .select("live_id")
    .eq("user_id", userId)
    .eq("live_id", liveId)
    .maybeSingle();
  return !!data;
}
