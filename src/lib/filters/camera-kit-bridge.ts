// Bridge JS ↔ module natif Snap Camera Kit (Expo).
// Tant que le module natif n'est pas lié au binary (prebuild + SDK Snap),
// les appels échouent proprement et l'UI garde les styles locaux.

import { NativeModules, Platform } from "react-native";
import {
  hasSnapCameraKitConfig,
  snapApiToken,
  SNAP_LENS_GROUP_ID,
  SNAP_LENS_GROUP_IDS,
} from "./camera-kit";
import type { Lens } from "./lenses-catalog";

export type BridgeLens = {
  lensId: string;
  groupId: string;
  name: string;
  iconUrl?: string;
  previewUrl?: string;
};

type KidiCameraKitNative = {
  initialize(apiToken: string, groupIds: string[]): Promise<void>;
  loadLenses(groupIds: string[]): Promise<{
    lenses: Array<{
      id: string;
      groupId: string;
      name: string;
      iconUrl?: string;
      previewUrl?: string;
    }>;
  }>;
  applyLens(lensId: string, groupId: string): Promise<void>;
  clearLens(): Promise<void>;
  startPreview(mirrored: boolean, facing: "user" | "environment"): Promise<void>;
  stopPreview(): Promise<void>;
  flipCamera(): Promise<{ flipped: boolean; facing: "user" | "environment" }>;
  isAvailable(): Promise<{ available: boolean; supported: boolean; hasToken: boolean }>;
  getStatus(): Promise<{
    ready: boolean;
    initialized: boolean;
    sessionStarted: boolean;
    captureRunning: boolean;
  }>;
};

const native: KidiCameraKitNative | undefined = NativeModules.KidiCameraKit;

let lensesCache: BridgeLens[] | null = null;
let initPromise: Promise<void> | null = null;

export function isNativeCameraKitLinked(): boolean {
  return !!native && typeof native.initialize === "function";
}

export function isCameraKitSupported(): boolean {
  if (!hasSnapCameraKitConfig()) return false;
  // Web: no WASM Camera Kit in Expo RN web yet.
  if (Platform.OS === "web") return false;
  return isNativeCameraKitLinked();
}

async function ensureInitialized(): Promise<KidiCameraKitNative> {
  if (!native) {
    throw new Error(
      "Module Camera Kit natif absent — rebuild l’app (expo prebuild + SDK Snap).",
    );
  }
  if (!initPromise) {
    initPromise = native.initialize(snapApiToken(), SNAP_LENS_GROUP_IDS).catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  await initPromise;
  return native;
}

export function clearBridgeLensesCache() {
  lensesCache = null;
}

export async function loadBridgeLenses(force = false): Promise<BridgeLens[]> {
  if (!force && lensesCache) return lensesCache;
  const mod = await ensureInitialized();
  const res = await mod.loadLenses(SNAP_LENS_GROUP_IDS);
  lensesCache = (res.lenses ?? []).map((l) => ({
    lensId: l.id,
    groupId: l.groupId || SNAP_LENS_GROUP_ID,
    name: l.name || "Lens",
    iconUrl: l.iconUrl,
    previewUrl: l.previewUrl,
  }));
  return lensesCache;
}

export async function applyBridgeLens(lens: Pick<Lens, "lensId" | "groupId" | "isSnapLens">) {
  if (!lens.isSnapLens || lens.lensId === "none") {
    if (isNativeCameraKitLinked()) {
      try {
        await native!.clearLens();
      } catch {
        /* ignore */
      }
    }
    return;
  }
  const mod = await ensureInitialized();
  await mod.applyLens(lens.lensId, lens.groupId || SNAP_LENS_GROUP_ID);
}

export async function clearBridgeLens() {
  if (!isNativeCameraKitLinked()) return;
  try {
    await native!.clearLens();
  } catch {
    /* ignore */
  }
}

export async function startBridgePreview(facing: "user" | "environment") {
  const mod = await ensureInitialized();
  await mod.startPreview(facing === "user", facing);
}

export async function stopBridgePreview() {
  if (!isNativeCameraKitLinked()) return;
  try {
    await native!.stopPreview();
  } catch {
    /* ignore */
  }
}
