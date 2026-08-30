import { supabase } from "./supabase";
import { LIVE_FX_EVENT, type LiveFxPayload } from "./live-fx";

/** Send overlay (image / teinte) on the same realtime room as enchères. */
export function sendLiveFxBroadcast(liveId: string, payload: LiveFxPayload): void {
  if (!liveId) return;
  const topicEnd = `live:${liveId}`;
  const existing = supabase.getChannels().find((ch) => ch.topic.endsWith(topicEnd));
  const ch = existing ?? supabase.channel(topicEnd);
  void ch.send({ type: "broadcast", event: LIVE_FX_EVENT, payload });
}
