/** Carousel order: Aucun, Snap AR, then local style fallbacks. */
export function composeCarouselLenses<T extends { lensId: string }>(
  none: T,
  snap: T[],
  styles: T[],
): T[] {
  return [none, ...snap, ...styles.filter((l) => l.lensId !== none.lensId)];
}
