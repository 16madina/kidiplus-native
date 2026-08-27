import { supabase } from "./supabase";
import { resolveAvatarUrl } from "./storage";

export const MAX_LIVE_MODERATORS = 3;

export type ModeratorRow = {
  liveId: string;
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
};

export type ModeratorCandidate = {
  id: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
};

async function hydrate(
  rows: Array<{ id: string; display_name: string | null; handle: string | null; avatar_url: string | null }>,
): Promise<ModeratorCandidate[]> {
  return Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      displayName: p.display_name,
      handle: p.handle,
      avatarUrl: p.avatar_url ? await resolveAvatarUrl(p.avatar_url) : null,
    })),
  );
}

export async function fetchModerators(liveId: string): Promise<ModeratorRow[]> {
  const { data, error } = await supabase
    .from("live_moderators")
    .select(
      "live_id, user_id, added_by, created_at, profiles:profiles!live_moderators_user_id_fkey(display_name, handle, avatar_url)",
    )
    .eq("live_id", liveId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const out: ModeratorRow[] = [];
  for (const r of data as unknown as Array<{
    live_id: string;
    user_id: string;
    profiles: { display_name: string | null; handle: string | null; avatar_url: string | null } | null;
  }>) {
    out.push({
      liveId: r.live_id,
      userId: r.user_id,
      displayName: r.profiles?.display_name ?? null,
      handle: r.profiles?.handle ?? null,
      avatarUrl: r.profiles?.avatar_url ? await resolveAvatarUrl(r.profiles.avatar_url) : null,
    });
  }
  return out;
}

export async function addModerator(
  liveId: string,
  userId: string,
  addedBy: string,
): Promise<{ ok: boolean; error?: string; code?: string }> {
  const existing = await fetchModerators(liveId);
  if (existing.length >= MAX_LIVE_MODERATORS) {
    return { ok: false, code: "moderator_limit_reached" };
  }
  if (existing.some((m) => m.userId === userId)) {
    return { ok: false, code: "already_mod" };
  }
  const { data: follow } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("followed_id", addedBy)
    .eq("follower_id", userId)
    .maybeSingle();
  if (!follow) return { ok: false, code: "moderator_not_follower" };
  const { error } = await supabase
    .from("live_moderators")
    .insert({ live_id: liveId, user_id: userId, added_by: addedBy });
  if (error) {
    const msg = error.message || "";
    if (/moderator_limit_reached/i.test(msg)) return { ok: false, code: "moderator_limit_reached" };
    if (/moderator_not_follower/i.test(msg)) return { ok: false, code: "moderator_not_follower" };
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export async function removeModerator(liveId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("live_moderators").delete().eq("live_id", liveId).eq("user_id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function fetchFollowerIds(hostId: string, limit = 200): Promise<string[]> {
  const { data } = await supabase.from("follows").select("follower_id").eq("followed_id", hostId).limit(limit);
  return (data ?? []).map((r) => r.follower_id as string).filter(Boolean);
}

export async function fetchModeratorCandidatesByIds(
  ids: string[],
  opts: { hostId: string; excludeIds: Set<string>; limit?: number },
): Promise<ModeratorCandidate[]> {
  const wanted = [...new Set(ids.filter((id) => id && !opts.excludeIds.has(id) && id !== opts.hostId))].slice(
    0,
    opts.limit ?? 20,
  );
  if (wanted.length === 0) return [];
  const followerIds = new Set(await fetchFollowerIds(opts.hostId));
  const allowed = wanted.filter((id) => followerIds.has(id));
  if (allowed.length === 0) return [];
  const { data } = await supabase.from("profiles").select("id, display_name, handle, avatar_url").in("id", allowed);
  return hydrate((data ?? []) as Array<{ id: string; display_name: string | null; handle: string | null; avatar_url: string | null }>);
}

export async function fetchFollowerModeratorCandidates(
  hostId: string,
  opts: { excludeIds: Set<string>; limit?: number },
): Promise<ModeratorCandidate[]> {
  const ids = (await fetchFollowerIds(hostId)).filter((id) => !opts.excludeIds.has(id));
  return fetchModeratorCandidatesByIds(ids, { hostId, excludeIds: opts.excludeIds, limit: opts.limit ?? 16 });
}

export async function searchModeratorCandidates(
  query: string,
  opts: { hostId: string; excludeIds: Set<string>; limit?: number },
): Promise<ModeratorCandidate[]> {
  const cleaned = query.trim().replace(/^@+/, "").replace(/[%_,"]/g, "");
  if (cleaned.length < 1) return [];
  const allowed = (await fetchFollowerIds(opts.hostId)).filter((id) => !opts.excludeIds.has(id) && id !== opts.hostId);
  if (allowed.length === 0) return [];
  const pattern = `%${cleaned}%`;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_url")
    .in("id", allowed.slice(0, 150))
    .or(`display_name.ilike."${pattern}",handle.ilike."${pattern}"`)
    .order("handle", { ascending: true })
    .limit(opts.limit ?? 8);
  return hydrate((data ?? []) as Array<{ id: string; display_name: string | null; handle: string | null; avatar_url: string | null }>);
}
