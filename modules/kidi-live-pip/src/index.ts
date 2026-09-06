import { requireOptionalNativeModule } from "expo-modules-core";

export type PipEnableOptions = {
  enabled: boolean;
  /** iOS native LiveKit session — required when enabling on iOS. */
  url?: string;
  token?: string;
};

export type PipNativeStatus = {
  supported: boolean;
  eligible: boolean;
  connected: boolean;
  hasVideoTrack: boolean;
  hasVideoFrame: boolean;
  hasController: boolean;
  possible: boolean;
  active: boolean;
  sourceVisible: boolean;
  ready: boolean;
};

export type KidiLivePipNativeModule = {
  setEnabled(
    options: PipEnableOptions,
  ): boolean | Promise<boolean | { enabled: boolean; connected?: boolean }>;
  isSupported(): boolean;
  isActive(): boolean;
  isInPip?(): boolean;
  getStatus?(): Promise<PipNativeStatus>;
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
