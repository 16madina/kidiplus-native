import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  LIVE_FX_EVENT,
  LIVE_FX_REQUEST_EVENT,
  type LiveFxPayload,
} from "./live-fx";

export type LiveFxHostTransport = {
  send: (payload: LiveFxPayload) => void;
  close: () => void;
};

/**
 * Own a subscribed transport for host FX.
 *
 * The previous implementation looked up any existing live channel and sent
 * immediately. During Camera Kit publishing that channel can still be joining,
 * so Supabase drops the first image/effect payload. A dedicated subscribed
 * channel keeps the latest payload queued and answers late-viewer resync
 * requests.
 */
export function createLiveFxHostTransport(
  liveId: string,
  onResyncRequest: () => void,
): LiveFxHostTransport {
  let channel: RealtimeChannel | null = null;
  let subscribed = false;
  let closed = false;
  let latest: LiveFxPayload | null = null;

  const publishLatest = () => {
    if (!subscribed || !channel || !latest || closed) return;
    void channel.send({
      type: "broadcast",
      event: LIVE_FX_EVENT,
      payload: latest,
    });
  };

  if (liveId) {
    channel = supabase
      .channel(`live:${liveId}`, {
        config: { broadcast: { self: false, ack: true } },
      })
      .on("broadcast", { event: LIVE_FX_REQUEST_EVENT }, () => {
        onResyncRequest();
      })
      .subscribe((status) => {
        subscribed = status === "SUBSCRIBED";
        if (subscribed) publishLatest();
      });
  }

  return {
    send(payload) {
      latest = payload;
      publishLatest();
    },
    close() {
      closed = true;
      subscribed = false;
      const current = channel;
      channel = null;
      if (current) void supabase.removeChannel(current);
    },
  };
}
