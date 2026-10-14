import { requireOptionalNativeModule } from "expo-modules-core";

export type PortraitExportResult = {
  /** file:// uri of the re-encoded mp4 in the app cache. */
  uri: string;
  width: number;
  height: number;
  /** Bytes. */
  size: number;
};

export type KidiVideoExportNativeModule = {
  /** Center-crop to 9:16, scale to 720x1280, H.264/AAC mp4. */
  exportPortrait(options: { uri: string }): Promise<PortraitExportResult>;
};

export const KidiVideoExport: KidiVideoExportNativeModule | null =
  requireOptionalNativeModule<KidiVideoExportNativeModule>("KidiVideoExport");
