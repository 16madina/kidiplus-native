import { requireOptionalNativeModule } from "expo-modules-core";

export type PipEnableOptions = {
  enabled: boolean;
  /** iOS native LiveKit session — required when enabling on iOS. */
  url?: string;
  token?: string;
};

export type KidiLivePipNativeModule = {
  setEnabled(
    options: PipEnableOptions,
  ): boolean | Promise<boolean | { enabled: boolean }>;
  isSupported(): boolean;
  isActive(): boolean;
  isInPip?(): boolean;
  enter(): Promise<boolean>;
  dismiss(): Promise<boolean>;
  addListener(
    eventName: "onPipModeChange" | "onPipPrepare",
    listener: (event: { active?: boolean }) => void,
  ): { remove(): void };
};

export const KidiLivePip: KidiLivePipNativeModule | null =
  requireOptionalNativeModule<KidiLivePipNativeModule>("KidiLivePip");

export default KidiLivePip;
