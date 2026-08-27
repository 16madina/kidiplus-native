// Minimal moderation helpers for DM inbox filtering + block from chat.

import { supabase } from "./supabase";

export async function blockUser(blockedId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("block_user", { _blocked_id: blockedId } as never);
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; error?: string } | null;
  return { ok: r?.ok !== false, ...(r?.error ? { error: r.error } : {}) };
}

export async function unblockUser(blockedId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("unblock_user", { _blocked_id: blockedId } as never);
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; error?: string } | null;
  return { ok: r?.ok !== false, ...(r?.error ? { error: r.error } : {}) };
}

export async function listMyBlockedIds(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("list_my_blocks" as never);
  if (error || !data) return new Set();
  const rows = (data as { rows?: Array<{ blocked_id: string }> }).rows ?? [];
  return new Set(rows.map((r) => r.blocked_id).filter(Boolean));
}

export async function submitReport(args: {
  targetType: string;
  targetId: string;
  reason: string;
  note?: string;
}): Promise<boolean> {
  const { error } = await supabase.rpc("submit_report", {
    _target_type: args.targetType,
    _target_id: args.targetId,
    _reason: args.reason,
    _note: args.note ?? null,
  } as never);
  return !error;
}
