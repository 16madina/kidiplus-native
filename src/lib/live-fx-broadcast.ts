import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  LIVE_FX_EVENT,
  LIVE_FX_REQUEST_EVENT,
  liveFxChannelName,
  type LiveFxPayload,
} from "./live-fx";

export type LiveFxHostTransport = {
  send: (payload: LiveFxPayload) => void;
  close: () => void;
};

function findSharedLiveChannel(liveId: string): RealtimeChannel | undefined {
  const topicEnd = `live:${liveId}`;
  return supabase.getChannels().find((ch) => ch.topic.endsWith(topicEnd));
}

/**
 * Codex found the hole: FX was sent before the channel was ready, so late
 * viewers got video without the image. We keep the last payload and flush it
 * once subscribed. Own channel `live-fx:` so we never tear down the enchères
 * channel (`live:`).
 */
export function createLiveFxHostTransport(
  liveId: string,
  onResyncRequest: () => void,
): LiveFxHostTransport {
  let latest: LiveFxPayload | null = null;
  let subscribed = false;
  let closed = false;
  let channel: RealtimeChannel | null = null;

  const publish = () => {
    if (closed || !latest) return;
    if (subscribed && channel) {
      void channel.send({ type: "broadcast", event: LIVE_FX_EVENT, payload: latest });
    }
    const shared = findSharedLiveChannel(liveId);
    if (shared) {
      void shared.send({ type: "broadcast", event: LIVE_FX_EVENT, payload: latest });
    }
  };

  if (liveId) {
    channel = supabase
      .channel(liveFxChannelName(liveId), {
        config: { broadcast: { self: false, ack: true } },
      })
      .on("broadcast", { event: LIVE_FX_REQUEST_EVENT }, () => {
        onResyncRequest();
      })
      .subscribe((status) => {
        subscribed = status === "SUBSCRIBED";
        if (subscribed) publish();
      });

    const shared = findSharedLiveChannel(liveId);
    shared?.on("broadcast", { event: LIVE_FX_REQUEST_EVENT }, () => {
      onResyncRequest();
    });
  }

  return {
    send(payload) {
      latest = payload;
      publish();
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
