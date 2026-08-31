import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { VideoTrack, isTrackReference, useParticipants, useTracks } from "@livekit/react-native";
import { RemoteTrackPublication, Track } from "livekit-client";
import { shouldSubscribeBattleHudParticipant } from "../../lib/battle-guest-publish";
import { isBattleGuestIdentity } from "../../lib/battles";

const FILL = StyleSheet.absoluteFill;

function useBattleHudSubscriptions(hostIdentity: string) {
  const people = useParticipants();
  useEffect(() => {
    for (const participant of people) {
      if (participant.isLocal) continue;
      const want = shouldSubscribeBattleHudParticipant(participant.identity, hostIdentity);
      for (const pub of participant.trackPublications.values()) {
        if (!(pub instanceof RemoteTrackPublication)) continue;
        if (pub.isSubscribed !== want) {
          try {
            pub.setSubscribed(want);
          } catch {
            /* publication may already be tearing down */
          }
        }
        if (!want) {
          const track = pub.track;
          if (track && "setVolume" in track && typeof track.setVolume === "function") {
            track.setVolume(0);
          }
        }
      }
    }
  }, [people, hostIdentity]);
}

/**
 * Renders the opponent's battle-guest camera inside the host HUD room.
 * The HUD connects as a viewer so it never kicks the native Camera Kit publisher.
 */
export function HostBattleGuestPane({ hostIdentity }: { hostIdentity: string }) {
  useBattleHudSubscriptions(hostIdentity);
  const tracks = useTracks([Track.Source.Camera]);
  const guestCamTrack = tracks.find(
    (t) =>
      isTrackReference(t) &&
      !t.participant.isLocal &&
      isBattleGuestIdentity(t.participant.identity),
  );
  if (!guestCamTrack || !isTrackReference(guestCamTrack)) return null;
  return <VideoTrack trackRef={guestCamTrack} style={FILL} objectFit="cover" />;
}
