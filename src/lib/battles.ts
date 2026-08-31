import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { resolveAvatarUrl } from "./storage";

export const BATTLE_COUNTDOWN_SEC = 15;
export const BATTLE_SUDDEN_DEATH_SEC = 60;

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

export type BattleRpcOk = { ok: true } & Record<string, unknown>;
export type BattleRpcErr = { ok: false; error: string };
export type BattleRpc = BattleRpcOk | BattleRpcErr;

export type BattleLiveRow = {
  battle_id: string;
  live_id: string;
  seller_id: string;
  side: "a" | "b";
  active: boolean;
  room_name: string | null;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
};

export type BattleParticipantRow = {
  battle_id: string;
  seller_id: string;
  display_name: string | null;
  side: "a" | "b";
  score_amount_live: number;
  score_amount_confirmed: number;
  score_items: number;
  last_seen_at: string;
  left_at: string | null;
};

export type BattleSessionRow = {
  id: string;
  status: "pending" | "running" | "sudden_death" | "ended" | "cancelled";
  duration_sec: number;
  started_at: string | null;
  ends_at: string | null;
  ended_at: string | null;
  currency: string;
  live_winner_seller_id: string | null;
  winner_seller_id: string | null;
  end_reason: "timeout" | "forfeit" | "sudden_death" | "cancelled" | "disconnected" | null;
  sudden_death: boolean;
  rematch_of_battle_id: string | null;
  turn_side: "a" | "b" | null;
  turn_until: string | null;
  last_sale_text: string | null;
  last_sale_at: string | null;
  sudden_death_at: string | null;
};

export type HydratedBattle = {
  session: BattleSessionRow;
  lives: BattleLiveRow[];
  participants: BattleParticipantRow[];
};

type Rpc = BattleRpc;

function asRpc(data: unknown, error?: { message: string } | null): Rpc {
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === "object" && "ok" in data) {
    const r = data as { ok?: boolean; error?: string };
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "error" };
  }
  return { ok: false, error: "invalid_response" };
}

export function battleGuestIdentity(sellerId: string): string {
  return `battle_${sellerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)}`;
}

/** Subscribe-only HUD identity so the host JS room never collides with the native publisher. */
export function battleHudIdentity(sellerId: string): string {
  return `hud_${sellerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)}`;
}

export function isBattleGuestIdentity(identity: string): boolean {
  return identity.startsWith("battle_");
}

export function isBattleLiveActive(battle: HydratedBattle | null | undefined): boolean {
  const status = battle?.session?.status;
  return status === "running" || status === "sudden_death";
}

export function isBattleFinished(battle: HydratedBattle | null | undefined): boolean {
  const status = battle?.session?.status;
  return status === "ended" || status === "cancelled";
}

export async function battleInvite(args: {
  fromLiveId: string;
  toSellerId: string;
  durationSec: number;
  rematchOf?: string | null;
}): Promise<Rpc> {
  const { data, error } = await supabase.rpc("battle_invite", {
    _from_live_id: args.fromLiveId,
    _to_seller_id: args.toSellerId,
    _duration_sec: args.durationSec,
    _rematch_of: args.rematchOf ?? null,
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

export async function battleHeartbeat(battleId: string): Promise<Rpc> {
  const { data, error } = await supabase.rpc("battle_heartbeat", {
    _battle_id: battleId,
  } as never);
  return asRpc(data, error);
}

export async function battleEnd(
  battleId: string,
  reason: "timeout" | "forfeit" | "cancelled" | "sudden_death" | "disconnected",
  forfeitSellerId?: string | null,
): Promise<Rpc> {
  const { data, error } = await supabase.rpc("battle_end", {
    _battle_id: battleId,
    _reason: reason,
    _forfeit_seller_id: forfeitSellerId ?? null,
  } as never);
  return asRpc(data, error);
}

async function hydrateLives(
  battleId: string,
  raw: Array<{ live_id: string; seller_id: string; side: "a" | "b"; active: boolean }>,
): Promise<BattleLiveRow[]> {
  if (raw.length === 0) return [];
  const liveIds = raw.map((r) => r.live_id);
  const sellerIds = raw.map((r) => r.seller_id);
  const [{ data: lives }, { data: profiles }] = await Promise.all([
    supabase.from("lives").select("id, room_name").in("id", liveIds),
    supabase.from("profiles").select("id, display_name, handle, avatar_url").in("id", sellerIds),
  ]);
  const liveById = new Map((lives ?? []).map((l) => [l.id, l]));
  const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
  return Promise.all(
    raw.map(async (r) => {
      const p = profById.get(r.seller_id);
      const avatar = p?.avatar_url
        ? (await resolveAvatarUrl(p.avatar_url)) || p.avatar_url
        : null;
      return {
        battle_id: battleId,
        live_id: r.live_id,
        seller_id: r.seller_id,
        side: r.side,
        active: r.active,
        room_name: (liveById.get(r.live_id)?.room_name as string | null) ?? null,
        display_name: p?.display_name || p?.handle || "Boutique",
        handle: p?.handle ?? null,
        avatar_url: avatar,
      };
    }),
  );
}

export async function fetchBattleById(battleId: string): Promise<HydratedBattle | null> {
  const { data: session } = await supabase
    .from("battle_sessions")
    .select("*")
    .eq("id", battleId)
    .maybeSingle();
  if (!session) return null;
  const [{ data: lives }, { data: parts }] = await Promise.all([
    supabase
      .from("battle_lives")
      .select("live_id, seller_id, side, active")
      .eq("battle_id", battleId),
    supabase
      .from("battle_participants")
      .select(
        "battle_id, seller_id, display_name, side, score_amount_live, score_items, score_amount_confirmed, last_seen_at, left_at",
      )
      .eq("battle_id", battleId),
  ]);
  const hydratedLives = await hydrateLives(
    battleId,
    (lives ?? []) as Array<{
      live_id: string;
      seller_id: string;
      side: "a" | "b";
      active: boolean;
    }>,
  );
  return {
    session: session as unknown as BattleSessionRow,
    lives: hydratedLives,
    participants: (parts ?? []) as unknown as BattleParticipantRow[],
  };
}

export async function fetchBattleForLive(liveId: string | null): Promise<HydratedBattle | null> {
  if (!liveId) return null;
  const { data: link } = await supabase
    .from("battle_lives")
    .select("battle_id")
    .eq("live_id", liveId)
    .eq("active", true)
    .maybeSingle();
  const battleId = (link as { battle_id?: string } | null)?.battle_id;
  if (battleId) return fetchBattleById(battleId);

  const { data: recent } = await supabase
    .from("battle_lives")
    .select("battle_id")
    .eq("live_id", liveId)
    .limit(4);
  const ids = [
    ...new Set(((recent ?? []) as Array<{ battle_id: string }>).map((r) => r.battle_id)),
  ];
  if (ids.length === 0) return null;
  const { data: sessions } = await supabase
    .from("battle_sessions")
    .select("id, ended_at, status")
    .in("id", ids)
    .in("status", ["ended", "cancelled"])
    .order("ended_at", { ascending: false })
    .limit(1);
  const last = (sessions as Array<{ id: string; ended_at: string | null }> | null)?.[0];
  if (!last?.ended_at) return null;
  if (Date.now() - Date.parse(last.ended_at) > 3 * 60 * 1000) return null;
  return fetchBattleById(last.id);
}

export function useBattleForLive(liveId: string | null) {
  const [battle, setBattle] = useState<HydratedBattle | null>(null);
  const battleId = battle?.session?.id ?? null;

  useEffect(() => {
    if (!liveId) {
      setBattle(null);
      return;
    }
    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      void fetchBattleForLive(liveId).then((b) => {
        if (!cancelled) setBattle(b);
      });
    };
    const scheduleLoad = () => {
      if (debounce != null) return;
      debounce = setTimeout(() => {
        debounce = null;
        load();
      }, 400);
    };
    load();
    const ch = supabase
      .channel(`battle-lives:${liveId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_lives", filter: `live_id=eq.${liveId}` },
        scheduleLoad,
      )
      .subscribe();
    return () => {
      cancelled = true;
      if (debounce != null) clearTimeout(debounce);
      void supabase.removeChannel(ch);
    };
  }, [liveId]);

  useEffect(() => {
    if (!liveId || !battleId) return;
    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      void fetchBattleById(battleId).then((b) => {
        if (!cancelled && b) setBattle(b);
      });
    };
    const scheduleLoad = () => {
      if (debounce != null) return;
      debounce = setTimeout(() => {
        debounce = null;
        load();
      }, 400);
    };
    const ch = supabase
      .channel(`battle-session:${battleId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_sessions", filter: `id=eq.${battleId}` },
        scheduleLoad,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battle_participants",
          filter: `battle_id=eq.${battleId}`,
        },
        scheduleLoad,
      )
      .subscribe();
    return () => {
      cancelled = true;
      if (debounce != null) clearTimeout(debounce);
      void supabase.removeChannel(ch);
    };
  }, [liveId, battleId]);

  return battle;
}

export async function searchSellerProfiles(
  query: string,
  limit = 30,
): Promise<
  Array<{ id: string; display_name: string | null; handle: string | null; avatar_url: string | null }>
> {
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
