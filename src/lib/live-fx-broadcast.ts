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
  return supabase
    .getChannels()
    .find((ch) => ch.topic === `realtime:live:${liveId}`);
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
    if (shared?.state === "joined") {
      void shared.send({ type: "broadcast", event: LIVE_FX_EVENT, payload: latest });
    }
  };

  if (liveId) {
    void (async () => {
      const channelName = liveFxChannelName(liveId);
      const topic = `realtime:${channelName}`;
      for (const previous of supabase
        .getChannels()
        .filter((candidate) => candidate.topic === topic)) {
        await supabase.removeChannel(previous);
      }
      if (closed) return;

      const ownChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false, ack: true } },
      });
      channel = ownChannel;
      ownChannel.on("broadcast", { event: LIVE_FX_REQUEST_EVENT }, () => {
        if (closed || channel !== ownChannel) return;
        onResyncRequest();
      });
      ownChannel.subscribe((status) => {
        if (closed || channel !== ownChannel) return;
        subscribed = status === "SUBSCRIBED";
        if (subscribed) publish();
      });
    })();
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
