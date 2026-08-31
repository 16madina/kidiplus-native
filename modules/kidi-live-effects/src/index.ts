import { requireOptionalNativeModule, requireNativeViewManager } from "expo-modules-core";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";
import { Platform } from "react-native";

export type LiveEffectsNativeConfig = {
  backgroundUrl: string | null;
  backgroundMode: string;
  posterUrl: string | null;
  posterMode: string;
  posterX: number;
  posterY: number;
  posterScale: number;
  mirror: boolean;
  facing: string;
};

export type KidiLiveEffectsNativeModule = {
  warmup(): Promise<{ supported: boolean }>;
  preloadBackground?(url: string): Promise<{ ready: boolean }>;
  start(config: LiveEffectsNativeConfig): Promise<{ started: boolean }>;
  attachPublished?(config: LiveEffectsNativeConfig): Promise<{ attached: boolean }>;
  detachPublished?(): Promise<{ detached: boolean }>;
  setConfig(config: LiveEffectsNativeConfig): Promise<{ updated: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
};

export const KidiLiveEffects: KidiLiveEffectsNativeModule | null =
  requireOptionalNativeModule<KidiLiveEffectsNativeModule>("KidiLiveEffects");

export const KidiLiveEffectsPreviewNative: ComponentType<ViewProps> | null =
  Platform.OS === "web"
    ? null
    : (() => {
        try {
          return requireNativeViewManager<ViewProps>("KidiLiveEffects");
        } catch {
          return null;
        }
      })();

export default KidiLiveEffects;
