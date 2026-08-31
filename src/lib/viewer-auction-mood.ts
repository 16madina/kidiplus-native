export type ViewerAuctionMood = "normal" | "leading" | "outbid" | "won" | "lost";

export const VIEWER_AUCTION_URGENT_SECONDS = 5;

export function viewerAuctionMood(opts: {
  auctionLive: boolean;
  ended: boolean;
  isHighest: boolean;
  participated: boolean;
  viewerId: string | null | undefined;
  winnerId: string | null | undefined;
}): ViewerAuctionMood {
  if (opts.ended) {
    if (opts.viewerId && opts.winnerId && opts.viewerId === opts.winnerId) return "won";
    return "lost";
  }
  if (!opts.auctionLive) return "normal";
  if (opts.isHighest) return "leading";
  if (opts.participated) return "outbid";
  return "normal";
}

/** Flash + vibrate only when the viewer just lost the lead. */
export function shouldFlashOutbid(wasHighest: boolean, isHighest: boolean, auctionLive: boolean): boolean {
  return auctionLive && wasHighest && !isHighest;
}

export function viewerAuctionUrgent(secondsLeft: number | null | undefined): boolean {
  if (secondsLeft == null) return false;
  return secondsLeft > 0 && secondsLeft <= VIEWER_AUCTION_URGENT_SECONDS;
}
