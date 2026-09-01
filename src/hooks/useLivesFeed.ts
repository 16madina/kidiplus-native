import { useEffect, useState } from "react";
import {
  getLivesFeedSnapshot,
  reloadLivesFeed,
  subscribeLivesFeed,
} from "../lib/lives-feed-sync";

/** Shared home / search / vitrine live list — realtime + short poll. */
export function useLivesFeed() {
  const [snap, setSnap] = useState(getLivesFeedSnapshot);

  useEffect(() => subscribeLivesFeed(setSnap), []);

  return {
    active: snap.active,
    upcoming: snap.upcoming,
    loading: snap.loading,
    refresh: () => reloadLivesFeed({ housekeep: true }),
  };
}
