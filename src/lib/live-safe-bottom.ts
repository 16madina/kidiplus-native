/**
 * Live viewer / host chrome must sit above the home indicator.
 * KeyboardAvoidingView on iOS can reset paddingBottom to 0 when the
 * keyboard hides — so callers should set `bottom`, not only padding.
 */
export function liveSafeBottom(insetsBottom: number, extra = 8): number {
  return Math.max(insetsBottom, 20) + extra;
}
