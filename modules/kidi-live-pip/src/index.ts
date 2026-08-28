import { requireOptionalNativeModule } from "expo-modules-core";

export type KidiLivePipNativeModule = {
  setEnabled(enabled: boolean): boolean;
  isSupported(): boolean;
  isActive(): boolean;
  enter(): Promise<boolean>;
  dismiss(): Promise<boolean>;
  addListener(
    eventName: "onPipModeChange",
    listener: (event: { active: boolean }) => void,
  ): { remove(): void };
};

export const KidiLivePip: KidiLivePipNativeModule | null =
  requireOptionalNativeModule<KidiLivePipNativeModule>("KidiLivePip");

export default KidiLivePip;
