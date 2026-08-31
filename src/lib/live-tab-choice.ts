/**
 * « Commencer un live » / « Programmer un live » on the Live tab.
 * Same 9:17 portrait as kidiplus.com `ChoiceCard` (was a squat 210pt).
 */
export const LIVE_TAB_CHOICE = {
  aspectRatio: 9 / 17,
  minHeight: 280,
} as const;

export function liveTabChoiceHeight(cardWidth: number): number {
  return Math.max(LIVE_TAB_CHOICE.minHeight, cardWidth / LIVE_TAB_CHOICE.aspectRatio);
}
