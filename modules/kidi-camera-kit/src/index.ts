import { requireOptionalNativeModule } from "expo-modules-core";

export type KidiCameraKitNativeModule = {
  initialize(apiToken: string, groupIds: string[]): Promise<{ initialized: boolean }>;
  loadLenses(groupIds: string[]): Promise<{
    lenses: Array<{
      id: string;
      groupId: string;
      name: string;
      iconUrl?: string;
      previewUrl?: string;
    }>;
  }>;
  applyLens(lensId: string, groupId: string): Promise<{ applied: boolean }>;
  clearLens(): Promise<{ cleared: boolean }>;
  startPreview(mirrored: boolean, facing: string): Promise<{ started: boolean }>;
  stopPreview(): Promise<{ stopped: boolean }>;
  flipCamera(): Promise<{ flipped: boolean; facing: string }>;
  setPublishEnabled(
    enabled: boolean,
    roomUrl: string | null,
    token: string | null,
  ): Promise<{ enabled: boolean }>;
  getStatus(): Promise<Record<string, unknown>>;
  isAvailable(): Promise<{ available: boolean; supported: boolean; hasToken: boolean }>;
};

/** Present only after a native rebuild that links this Expo module. */
export const KidiCameraKit: KidiCameraKitNativeModule | null =
  requireOptionalNativeModule<KidiCameraKitNativeModule>("KidiCameraKit");

export default KidiCameraKit;
