import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { resolveAvatarUrl } from "./storage";

export const BATTLE_DURATIONS_SEC = [600, 900, 1200, 1800] as const;
export const BATTLE_DEFAULT_DURATION_SEC = 900;
export const BATTLE_PROTO_DEMO_SEC = 90;

export type BattleInviteDraft = {
  toSellerId: string;
  toLiveId: string | null;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  isLive: boolean;
};

export type IncomingBattleInvite = {
  id: string;
  fromSellerId: string;
  fromLiveId: string | null;
  fromName: string;
  fromHandle: string | null;
  fromAvatarUrl: string | null;
  durationSec: number;
};

type Rpc = { ok: true } | { ok: false; error: string };

function asRpc(data: unknown, error?: { message: string } | null): Rpc {
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === "object" && "ok" in data) {
    const r = data as { ok?: boolean; error?: string };
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "error" };
  }
  return { ok: false, error: "invalid_response" };
}

export async function battleInvite(args: {
  fromLiveId: string;
  toSellerId: string;
  durationSec: number;
}): Promise<Rpc> {
  const { data, error } = await supabase.rpc("battle_invite", {
    _from_live_id: args.fromLiveId,
    _to_seller_id: args.toSellerId,
    _duration_sec: args.durationSec,
    _rematch_of: null,
  } as never);
  if (error) {
    const retry = await supabase.rpc("battle_invite", {
      _from_live_id: args.fromLiveId,
      _to_seller_id: args.toSellerId,
      _duration_sec: args.durationSec,
    } as never);
    return asRpc(retry.data, retry.error);
  }
  return asRpc(data, error);
}

export async function battleAccept(inviteId: string): Promise<Rpc> {
  const { data, error } = await supabase.rpc("battle_accept", {
    _invite_id: inviteId,
    _duration_sec: null,
  } as never);
  return asRpc(data, error);
}

export async function battleDecline(inviteId: string): Promise<Rpc> {
  const { data, error } = await supabase.rpc("battle_decline", {
    _invite_id: inviteId,
  } as never);
  return asRpc(data, error);
}

export async function searchSellerProfiles(
  query: string,
  limit = 30,
): Promise<Array<{ id: string; display_name: string | null; handle: string | null; avatar_url: string | null }>> {
  const q = query.trim().replace(/^@+/, "").replace(/[%_,"]/g, "");
  if (q.length < 2) return [];
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_url")
    .eq("is_seller", true)
    .or(`display_name.ilike."${pattern}",handle.ilike."${pattern}"`)
    .limit(limit);
  return (data ?? []) as Array<{
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  }>;
}

export function usePendingBattleInvite(userId: string | null) {
  const [invite, setInvite] = useState<IncomingBattleInvite | null>(null);

  useEffect(() => {
    if (!userId) {
      setInvite(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("battle_invites")
        .select(
          "id, from_live_id, from_seller_id, to_seller_id, to_live_id, duration_sec, status, expires_at, battle_id",
        )
        .eq("to_seller_id", userId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setInvite(null);
        return;
      }
      const row = data as {
        id: string;
        from_live_id: string | null;
        from_seller_id: string;
        duration_sec: number;
      };
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, handle, avatar_url")
        .eq("id", row.from_seller_id)
        .maybeSingle();
      if (cancelled) return;
      setInvite({
        id: row.id,
        fromSellerId: row.from_seller_id,
        fromLiveId: row.from_live_id,
        fromName: p?.display_name || p?.handle || "Boutique",
        fromHandle: p?.handle ?? null,
        fromAvatarUrl: p?.avatar_url ? await resolveAvatarUrl(p.avatar_url) : null,
        durationSec: row.duration_sec,
      });
    };
    void load();
    const ch = supabase
      .channel(`battle-invites:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_invites", filter: `to_seller_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [userId]);

  return invite;
}
