import type { HostFeaturedLayout } from "./host-featured-layout";

/** Portrait featured card — kept short so the host face stays visible. */
export const HOST_PORTRAIT_CARD_WIDTH = 122;

/**
 * Where the right rail sits: pinned above the chat, not next to the card.
 * `composerReserve` is input height + bottom padding.
 */
export function hostRailBottom(insetsBottom: number, composerReserve = 64): number {
  return insetsBottom + composerReserve;
}

/** Featured card hugs the right edge — the rail is lower, so they no longer share a column. */
export function hostFeaturedRight(): number {
  return 10;
}

/** Auction pills stay left of the rail (and of the portrait card). */
export function hostAuctionGutter(opts: {
  layout: HostFeaturedLayout;
  icon: number;
  portraitCardWidth?: number;
}): { left: number; right: number } {
  const rail = opts.icon + 14;
  if (opts.layout === "portrait") {
    const card = opts.portraitCardWidth ?? HOST_PORTRAIT_CARD_WIDTH;
    return { left: 12, right: Math.max(rail, card + 16) };
  }
  return { left: 12, right: rail };
}

/** Landscape card is short; sit the 10 / mort subite / bid just under it. */
export function hostAuctionTopExtra(opts: {
  layout: HostFeaturedLayout;
  featuredTopExtra: number;
  compact: boolean;
}): number {
  if (opts.layout === "landscape") {
    return opts.featuredTopExtra + (opts.compact ? 86 : 104);
  }
  return opts.featuredTopExtra + (opts.compact ? 8 : 12);
}
