export type HostFeaturedLayout = "portrait" | "landscape";

export const DEFAULT_HOST_FEATURED_LAYOUT: HostFeaturedLayout = "portrait";
export const HOST_FEATURED_LAYOUT_KEY = "kidi.host-featured-layout";

export function parseHostFeaturedLayout(value: unknown): HostFeaturedLayout {
  return value === "landscape" ? "landscape" : "portrait";
}

export function toggleHostFeaturedLayout(current: HostFeaturedLayout): HostFeaturedLayout {
  return current === "portrait" ? "landscape" : "portrait";
}

export type HostFeaturedCtaKind = "start" | "timer" | "replay" | "list" | "listed";

/**
 * Layout is display-only. Switching portrait/landscape must never change
 * the sale: same CTA kind, same price line once the auction is live.
 */
export function featuredPriceLine(opts: {
  auctionLive: boolean;
  mode: "auction" | "fixed";
  layout: HostFeaturedLayout;
  priceLabel: string;
  startLabel: string;
}): string {
  if (opts.auctionLive) return opts.priceLabel;
  if (opts.layout === "landscape" && opts.mode === "auction") return opts.startLabel;
  return opts.priceLabel;
}

/** What the yellow featured-card button shows. */
export function hostFeaturedCtaKind(opts: {
  mode: "auction" | "fixed";
  status: string;
  auctionLive: boolean;
}): HostFeaturedCtaKind {
  if (opts.auctionLive) return "timer";
  if (opts.mode === "auction") {
    return opts.status === "sold" || opts.status === "unsold" ? "replay" : "start";
  }
  return opts.status === "active" ? "listed" : "list";
}
