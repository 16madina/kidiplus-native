import type { CropRect } from "./publish-media";

/**
 * Do not import `expo-image-manipulator` from this file (or any module
 * loaded with Vitrine). Its JS calls requireNativeModule('ExpoImageManipulator')
 * at evaluation time. Metro treats a literal require() as a static dependency,
 * so the previous optional-load still crashed the app on binaries that were
 * not rebuilt after the package was added.
 *
 * After `npm run rebuild:ios` (native module in the binary), restore the
 * real crop in a follow-up. Until then, publish the original photo URI.
 */
export function isImageManipulatorAvailable(): boolean {
  return false;
}

export async function cropCoverImage(uri: string, _rect: CropRect): Promise<string> {
  return uri;
}
