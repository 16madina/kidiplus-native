// Responsive layout helpers for KiDi+ native.
// Design baseline ≈ iPhone 14 (390×844). Small phones (SE / compact Android)
// shrink control sizes and vertical stacks so HUD icons don't overflow.

import { Dimensions, PixelRatio, useWindowDimensions } from "react-native";

const BASE_W = 390;
const BASE_H = 844;

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function windowSize() {
  return Dimensions.get("window");
}

/** Scale by width (icons, fonts, horizontal paddings). */
export function s(n: number, width = windowSize().width) {
  const scale = clamp(width / BASE_W, 0.82, 1.06);
  return PixelRatio.roundToNearestPixel(n * scale);
}

/** Scale by height (absolute tops, vertical gaps, stack spacing). */
export function vs(n: number, height = windowSize().height) {
  const scale = clamp(height / BASE_H, 0.76, 1.05);
  return PixelRatio.roundToNearestPixel(n * scale);
}

export function isCompactHeight(height = windowSize().height) {
  return height < 720;
}

export function isNarrow(width = windowSize().width) {
  return width < 375;
}

/** Hook: live dimensions + precomputed flags for HUD layouts. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const compact = height < 720;
  const narrow = width < 375;
  return {
    width,
    height,
    compact,
    narrow,
    s: (n: number) => s(n, width),
    vs: (n: number) => vs(n, height),
    /** Icon / rail button edge length. */
    icon: compact || narrow ? s(40, width) : 44,
    /** Smaller icon for dense top bars. */
    iconSm: compact || narrow ? s(34, width) : 36,
    railGap: compact ? vs(6, height) : 10,
    railTopExtra: compact ? vs(168, height) : 244,
    featuredTopExtra: compact ? vs(72, height) : 96,
    statsTopExtra: compact ? vs(44, height) : 52,
    auctionTopExtra: compact ? vs(120, height) : 168,
    featuredWidth: compact || narrow ? s(92, width) : 108,
  };
}
