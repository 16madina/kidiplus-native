import { useCallback, useEffect, useRef, useState } from "react";
import {
  facebookReady,
  fetchFacebookStatus,
  startFacebookRestream,
  stopFacebookRestream,
  type FacebookStatus,
} from "./facebook-restream";
import {
  ensureYoutubeBroadcastLive,
  fetchYoutubeStatus,
  startYoutubeRestream,
  stopYoutubeRestream,
  type YoutubeStatus,
} from "./youtube-restream";
import { startTiktokRestream, stopTiktokRestream } from "./tiktok-restream";

export function useHostRestream(liveId: string, rtmpMode: boolean) {
  const [yt, setYt] = useState<YoutubeStatus | null>(null);
  const [fb, setFb] = useState<FacebookStatus | null>(null);
  const [ytOn, setYtOn] = useState(false);
  const [fbOn, setFbOn] = useState(false);
  const [ttOn, setTtOn] = useState(false);
  const [ytBusy, setYtBusy] = useState(false);
  const [fbBusy, setFbBusy] = useState(false);
  const [ttBusy, setTtBusy] = useState(false);
  const [ttSheet, setTtSheet] = useState(false);
  const promoteAbort = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [y, f] = await Promise.all([fetchYoutubeStatus(), fetchFacebookStatus()]);
      setYt(y);
      setFb(f);
    } catch {
      /* status is optional until connected */
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      promoteAbort.current?.abort();
    };
  }, [refresh]);

  const toggleYt = useCallback(async (): Promise<string | null> => {
    if (rtmpMode || ytBusy) return null;
    if (!yt?.connected) return "need_yt";
    setYtBusy(true);
    try {
      if (ytOn) {
        promoteAbort.current?.abort();
        await stopYoutubeRestream(liveId);
        setYtOn(false);
        return "yt_off";
      }
      await startYoutubeRestream(liveId);
      setYtOn(true);
      promoteAbort.current?.abort();
      const ac = new AbortController();
      promoteAbort.current = ac;
      void ensureYoutubeBroadcastLive(liveId, { signal: ac.signal });
      return "yt_on";
    } catch (e) {
      return e instanceof Error ? e.message : "yt_fail";
    } finally {
      setYtBusy(false);
    }
  }, [liveId, rtmpMode, ytBusy, yt?.connected, ytOn]);

  const toggleFb = useCallback(async (): Promise<string | null> => {
    if (rtmpMode || fbBusy) return null;
    if (!facebookReady(fb)) return "need_fb";
    setFbBusy(true);
    try {
      if (fbOn) {
        await stopFacebookRestream(liveId);
        setFbOn(false);
        return "fb_off";
      }
      await startFacebookRestream(liveId);
      setFbOn(true);
      return "fb_on";
    } catch (e) {
      return e instanceof Error ? e.message : "fb_fail";
    } finally {
      setFbBusy(false);
    }
  }, [liveId, rtmpMode, fbBusy, fb, fbOn]);

  const startTt = useCallback(
    async (creds: { serverUrl: string; streamKey: string }): Promise<string | null> => {
      if (rtmpMode || ttBusy) return null;
      setTtBusy(true);
      try {
        await startTiktokRestream({ liveId, ...creds });
        setTtOn(true);
        setTtSheet(false);
        return "tt_on";
      } catch (e) {
        return e instanceof Error ? e.message : "tt_fail";
      } finally {
        setTtBusy(false);
      }
    },
    [liveId, rtmpMode, ttBusy],
  );

  const toggleTt = useCallback(async (): Promise<string | null> => {
    if (rtmpMode || ttBusy) return null;
    if (!ttOn) {
      setTtSheet(true);
      return null;
    }
    setTtBusy(true);
    try {
      await stopTiktokRestream(liveId);
      setTtOn(false);
      return "tt_off";
    } catch (e) {
      return e instanceof Error ? e.message : "tt_fail";
    } finally {
      setTtBusy(false);
    }
  }, [liveId, rtmpMode, ttBusy, ttOn]);

  return {
    yt,
    fb,
    ytOn,
    fbOn,
    ttOn,
    ytBusy,
    fbBusy,
    ttBusy,
    ttSheet,
    setTtSheet,
    refresh,
    toggleYt,
    toggleFb,
    toggleTt,
    startTt,
  };
}
