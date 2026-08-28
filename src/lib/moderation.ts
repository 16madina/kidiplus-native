// Moderation — reports + blocks (same RPCs as kidiplus.com).

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type ReportTargetType = "live" | "message" | "user";
export type ReportReason = "inappropriate" | "fraud" | "counterfeit" | "harassment" | "other";

const LOCAL_BLOCKS_KEY = "kidi:local-blocks";

type LocalBlock = {
  blocked_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type BlockedRow = {
  blocked_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

function isFictitiousSellerId(id: string): boolean {
  return id.startsWith("fictitious:") || id.startsWith("demo:");
}

export async function blockUser(blockedId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("block_user", { _blocked_id: blockedId } as never);
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; error?: string } | null;
  return { ok: r?.ok !== false, ...(r?.error ? { error: r.error } : {}) };
}

export async function unblockUser(blockedId: string): Promise<{ ok: boolean; error?: string }> {
  if (isFictitiousSellerId(blockedId)) {
    await removeLocalBlock(blockedId);
    notifyBlockedListeners();
    return { ok: true };
  }
  const { data, error } = await supabase.rpc("unblock_user", { _blocked_id: blockedId } as never);
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; error?: string } | null;
  if (r?.ok !== false) notifyBlockedListeners();
  return { ok: r?.ok !== false, ...(r?.error ? { error: r.error } : {}) };
}

export async function listMyBlockedIds(): Promise<Set<string>> {
  const local = await readLocalBlocks();
  const { data, error } = await supabase.rpc("list_my_blocks" as never);
  const remote =
    !error && data
      ? ((data as { rows?: Array<{ blocked_id: string }> }).rows ?? []).map((r) => r.blocked_id)
      : [];
  return new Set([...local.map((r) => r.blocked_id), ...remote].filter(Boolean));
}

export async function listMyBlocks(): Promise<BlockedRow[]> {
  const local = await readLocalBlocks();
  const { data, error } = await supabase.rpc("list_my_blocks" as never);
  const remote = (!error && data ? (data as { rows?: BlockedRow[] }).rows : []) ?? [];
  const seen = new Set<string>();
  const merged: BlockedRow[] = [];
  for (const row of [...local, ...remote]) {
    if (seen.has(row.blocked_id)) continue;
    seen.add(row.blocked_id);
    merged.push(row);
  }
  return merged;
}

export async function submitReport(args: {
  targetType: ReportTargetType | string;
  targetId: string;
  reason: ReportReason | string;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cleanedId = (args.targetId ?? "").trim();
  if (!cleanedId) return { ok: false, error: "missing_target" };
  const { data, error } = await supabase.rpc("submit_report", {
    _target_type: args.targetType,
    _target_id: cleanedId,
    _reason: args.reason,
    _note: args.note ?? null,
  } as never);
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; error?: string } | null;
  if (r && r.ok === false) return { ok: false, error: r.error ?? "rejected" };
  return { ok: true };
}

/**
 * Block + notify via report (Apple Guideline 1.2).
 * Fictitious review sellers are stored locally.
 */
export async function blockUserAndNotify(
  blockedId: string,
  meta?: { handle?: string; displayName?: string; avatarUrl?: string | null; liveId?: string },
): Promise<{ ok: boolean; error?: string }> {
  const label = meta?.displayName || meta?.handle || blockedId;
  const note = [
    "User blocked from KiDi+.",
    `Target: ${label}`,
    meta?.liveId ? `Live: ${meta.liveId}` : null,
    isFictitiousSellerId(blockedId) ? "Fictitious review seller." : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (isFictitiousSellerId(blockedId)) {
    await addLocalBlock({
      blocked_id: blockedId,
      handle: meta?.handle || label,
      display_name: meta?.displayName || label,
      avatar_url: meta?.avatarUrl ?? null,
      created_at: new Date().toISOString(),
    });
    await submitReport({
      targetType: "user",
      targetId: blockedId,
      reason: "harassment",
      note,
    }).catch(() => null);
    notifyBlockedListeners();
    return { ok: true };
  }

  const r = await blockUser(blockedId);
  if (!r.ok) return r;
  await submitReport({
    targetType: "user",
    targetId: blockedId,
    reason: "harassment",
    note,
  }).catch(() => null);
  notifyBlockedListeners();
  return { ok: true };
}

async function readLocalBlocks(): Promise<LocalBlock[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_BLOCKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalBlock[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalBlocks(rows: LocalBlock[]) {
  try {
    await AsyncStorage.setItem(LOCAL_BLOCKS_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

async function addLocalBlock(row: LocalBlock) {
  const prev = (await readLocalBlocks()).filter((r) => r.blocked_id !== row.blocked_id);
  await writeLocalBlocks([row, ...prev]);
}

async function removeLocalBlock(blockedId: string) {
  await writeLocalBlocks((await readLocalBlocks()).filter((r) => r.blocked_id !== blockedId));
}

let blockedIdsCache: Set<string> | null = null;
const listeners = new Set<() => void>();

function notifyBlockedListeners() {
  blockedIdsCache = null;
  listeners.forEach((l) => l());
}

export async function refreshBlockedIds(): Promise<Set<string>> {
  const ids = await listMyBlockedIds();
  blockedIdsCache = ids;
  listeners.forEach((l) => l());
  return ids;
}

/** Hook: blocked user ids for feed filtering. */
export function useBlockedIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(blockedIdsCache ?? new Set());

  const reload = useCallback(() => {
    void listMyBlockedIds().then((next) => {
      blockedIdsCache = next;
      setIds(next);
    });
  }, []);

  useEffect(() => {
    reload();
    const listener = () => reload();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [reload]);

  return ids;
}
