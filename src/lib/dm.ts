// Direct-messaging — same RPCs as kidiplus.com (dm_threads / dm_messages).

import { supabase } from "./supabase";

export type DmThreadRow = {
  id: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_id: string | null;
  other_id: string;
  other_name: string | null;
  other_handle: string | null;
  other_avatar_url: string | null;
  other_is_seller: boolean;
  other_is_verified: boolean;
  unread: number;
};

export type DmMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type DmChatTarget = {
  otherId: string;
  otherName: string;
  otherAvatarUrl?: string | null;
  otherIsVerified?: boolean;
  threadId?: string | null;
};

export async function listMyDmThreads(
  limit = 50,
): Promise<{ rows: DmThreadRow[]; unread: number }> {
  const { data, error } = await supabase.rpc("list_my_dm_threads", { _limit: limit } as never);
  if (error || !data) return { rows: [], unread: 0 };
  const payload = data as { rows?: DmThreadRow[]; unread?: number };
  return {
    rows: (payload.rows ?? []) as DmThreadRow[],
    unread: Number(payload.unread ?? 0),
  };
}

export async function listDmMessages(
  threadId: string,
  limit = 60,
  before?: string,
): Promise<DmMessageRow[]> {
  const { data, error } = await supabase.rpc("list_dm_messages", {
    _thread: threadId,
    _limit: limit,
    _before: before ?? null,
  } as never);
  if (error || !data) return [];
  const payload = data as { rows?: DmMessageRow[] };
  return ((payload.rows ?? []) as DmMessageRow[]).slice().reverse();
}

export async function findDmThread(otherId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("find_dm_thread", { _other: otherId } as never);
  if (error) return null;
  return (data as string | null) ?? null;
}

export type SendDmResult =
  | { ok: true; threadId: string; message: DmMessageRow }
  | { ok: false; error: "blocked" | "suspended" | "unknown" };

export async function sendDm(toUserId: string, body: string): Promise<SendDmResult> {
  const { data, error } = await supabase.rpc("send_dm", {
    _to: toUserId,
    _body: body,
  } as never);
  if (error || !data) {
    const msg = String(error?.message ?? "");
    if (msg.includes("blocked")) return { ok: false, error: "blocked" };
    if (msg.includes("account_banned") || msg.includes("account_suspended")) {
      return { ok: false, error: "suspended" };
    }
    return { ok: false, error: "unknown" };
  }
  const payload = data as { thread_id: string; message: DmMessageRow };
  return {
    ok: true,
    threadId: payload.thread_id,
    message: payload.message,
  };
}

export async function markDmThreadRead(threadId: string): Promise<void> {
  await supabase.rpc("mark_dm_thread_read", { _thread: threadId } as never);
}

export function subscribeDmThread(threadId: string, onChange: () => void): () => void {
  const ch = supabase
    .channel(`dm-thread:${threadId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(ch);
  };
}

export function subscribeMyDmInbox(userId: string, onChange: () => void): () => void {
  const suffix = Math.random().toString(36).slice(2);
  const chA = supabase
    .channel(`dm-inbox-a:${userId}:${suffix}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_threads", filter: `user_a=eq.${userId}` },
      onChange,
    )
    .subscribe();
  const chB = supabase
    .channel(`dm-inbox-b:${userId}:${suffix}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_threads", filter: `user_b=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(chA);
    void supabase.removeChannel(chB);
  };
}
