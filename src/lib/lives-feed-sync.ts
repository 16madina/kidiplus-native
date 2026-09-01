import { AppState } from "react-native";
import { fetchActiveLives, fetchUpcomingScheduledLives } from "./lives";
import { subscribeHostLiveEnded, subscribeHostLiveStarted } from "./host-open-live";
import { supabase } from "./supabase";
import type { LiveStream } from "../mock/lives";

export type LivesFeedSnapshot = {
  active: LiveStream[];
  upcoming: LiveStream[];
  loading: boolean;
};

type Listener = (snap: LivesFeedSnapshot) => void;

const POLL_MS = 8_000;
const REALTIME_DEBOUNCE_MS = 250;

const listeners = new Set<Listener>();
let snapshot: LivesFeedSnapshot = { active: [], upcoming: [], loading: true };
let started = false;
let loadGen = 0;
let debounce: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const cb of listeners) cb(snapshot);
}

export function getLivesFeedSnapshot(): LivesFeedSnapshot {
  return snapshot;
}

export async function reloadLivesFeed(opts?: { housekeep?: boolean }): Promise<void> {
  const gen = ++loadGen;
  try {
    const [liveNow, soon] = await Promise.all([
      fetchActiveLives(60, { housekeep: opts?.housekeep === true }),
      fetchUpcomingScheduledLives(),
    ]);
    if (gen !== loadGen) return;
    snapshot = { active: liveNow, upcoming: soon, loading: false };
    emit();
  } catch {
    if (gen !== loadGen) return;
    snapshot = { ...snapshot, loading: false };
    emit();
  }
}

function scheduleReload() {
  if (debounce != null) return;
  debounce = setTimeout(() => {
    debounce = null;
    void reloadLivesFeed();
  }, REALTIME_DEBOUNCE_MS);
}

function dropEndedLive(liveId?: string | null) {
  if (liveId) {
    snapshot = {
      ...snapshot,
      active: snapshot.active.filter((s) => s.liveId !== liveId && s.id !== `db-${liveId}`),
    };
    emit();
  }
  void reloadLivesFeed();
}

export function ensureLivesFeedSync() {
  if (started) return;
  started = true;
  void reloadLivesFeed({ housekeep: true });
  subscribeHostLiveStarted(() => {
    void reloadLivesFeed();
  });
  subscribeHostLiveEnded((id) => dropEndedLive(id));
  const channel = supabase
    .channel(`lives-feed:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "lives" }, scheduleReload)
    .subscribe();
  pollTimer = setInterval(() => {
    if (AppState.currentState === "active") void reloadLivesFeed();
  }, POLL_MS);
  AppState.addEventListener("change", (state) => {
    if (state === "active") void reloadLivesFeed({ housekeep: true });
  });
  void channel;
}

export function subscribeLivesFeed(cb: Listener): () => void {
  ensureLivesFeedSync();
  listeners.add(cb);
  cb(snapshot);
  return () => {
    listeners.delete(cb);
  };
}
