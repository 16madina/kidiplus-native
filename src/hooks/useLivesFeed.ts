import { useEffect, useState } from "react";
import { fetchActiveLives, fetchUpcomingScheduledLives } from "../lib/lives";
import type { LiveStream } from "../mock/lives";

export function useLivesFeed() {
  const [active, setActive] = useState<LiveStream[]>([]);
  const [upcoming, setUpcoming] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [liveNow, soon] = await Promise.all([fetchActiveLives(), fetchUpcomingScheduledLives()]);
        if (cancelled) return;
        setActive(liveNow);
        setUpcoming(soon);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { active, upcoming, loading };
}
