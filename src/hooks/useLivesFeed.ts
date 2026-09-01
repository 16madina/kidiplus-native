import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { fetchActiveLives, fetchUpcomingScheduledLives } from "../lib/lives";
import { annotateLivesForCountry, resolveViewerCountry } from "../lib/delivery-feed";
import { subscribeHostLiveEnded } from "../lib/host-open-live";
import { useAuth } from "../context/auth";
import type { LiveStream } from "../mock/lives";

export function useLivesFeed() {
  const { user } = useAuth();
  const [active, setActive] = useState<LiveStream[]>([]);
  const [upcoming, setUpcoming] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [liveNow, soon, country] = await Promise.all([
        fetchActiveLives(),
        fetchUpcomingScheduledLives(),
        resolveViewerCountry(user?.id, user?.country),
      ]);
      const [rankedLive, rankedSoon] = await Promise.all([
        annotateLivesForCountry(liveNow, country),
        annotateLivesForCountry(soon, country),
      ]);
      setActive(rankedLive);
      setUpcoming(rankedSoon);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.country]);

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
