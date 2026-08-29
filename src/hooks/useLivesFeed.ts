import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { fetchActiveLives, fetchUpcomingScheduledLives } from "../lib/lives";
import { subscribeHostLiveEnded } from "../lib/host-open-live";
import type { LiveStream } from "../mock/lives";

export function useLivesFeed() {
  const [active, setActive] = useState<LiveStream[]>([]);
  const [upcoming, setUpcoming] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [liveNow, soon] = await Promise.all([fetchActiveLives(), fetchUpcomingScheduledLives()]);
      setActive(liveNow);
      setUpcoming(soon);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => sub.remove();
  }, [load]);

  useEffect(() => subscribeHostLiveEnded(() => { void load(); }), [load]);

  return { active, upcoming, loading, refresh: load };
}
