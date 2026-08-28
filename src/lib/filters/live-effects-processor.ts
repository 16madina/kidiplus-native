import {
  startNativeLiveEffects,
  stopNativeLiveEffects,
  syncNativeLiveEffects,
  warmupNativeLiveEffects,
  type NativeEffectsConfig,
} from "./live-effects-native-bridge";
import { startFramePump, type FramePump } from "./frame-pump";
import type { LiveEffectsConfig } from "./live-effects-compositor";

export type { LiveEffectsConfig };

/**
 * Native stand-in for the LiveKit TrackProcessor used on web.
 * Starts the Vision / ML Kit compositor session (preview + optional publish).
 */
export class LiveEffectsVideoProcessor {
  readonly name = "kidi-live-effects";
  private pump: FramePump | null = null;
  private config: LiveEffectsConfig;
  private running = false;

  constructor(config: LiveEffectsConfig) {
    this.config = config;
  }

  async warmup(): Promise<boolean> {
    return warmupNativeLiveEffects();
  }

  async start(): Promise<void> {
    if (this.running) {
      await this.setConfig(this.config);
      return;
    }
    const ok = await warmupNativeLiveEffects();
    if (!ok) {
      console.warn("[live-effects] warmup failed — starting anyway");
    }
    await startNativeLiveEffects(toNative(this.config));
    this.running = true;
    this.pump = startFramePump({
      onResume: () => {
        if (!this.running) return;
        void startNativeLiveEffects(toNative(this.config));
      },
    });
  }

  async setConfig(config: LiveEffectsConfig): Promise<void> {
    this.config = config;
    if (!this.running) return;
    await syncNativeLiveEffects(toNative(config));
  }

  setTransform(x: number, y: number, scale: number) {
    this.config = {
      ...this.config,
      posterX: x,
      posterY: y,
      posterScale: scale,
    };
    if (this.running) void syncNativeLiveEffects(toNative(this.config));
  }

  async destroy(): Promise<void> {
    this.running = false;
    this.pump?.stop();
    this.pump = null;
    await stopNativeLiveEffects();
  }
}

function toNative(cfg: LiveEffectsConfig): NativeEffectsConfig {
  return {
    backgroundUrl: cfg.backgroundUrl,
    backgroundMode: cfg.backgroundMode,
    posterUrl: cfg.posterUrl,
    posterMode: cfg.posterMode,
    posterX: cfg.posterX ?? 0.5,
    posterY: cfg.posterY ?? 0.4,
    posterScale: cfg.posterScale ?? 1,
    mirror: cfg.mirror,
    facing: cfg.facing ?? "user",
  };
}
