// Bridge JS ↔ module natif Snap Camera Kit (Expo).
// Tant que le module n'est pas lié au binary (prebuild + SDK Snap),
// les appels échouent proprement et l'UI garde les styles locaux.

import { Platform } from "react-native";
// Relative path: Metro resolves this even if `npm install` has not yet
// created node_modules/kidi-camera-kit (file: symlink). Native autolinking
// still uses the package.json dependency.
import { KidiCameraKit } from "../../../modules/kidi-camera-kit/src";
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

let lensesCache: BridgeLens[] | null = null;
let initPromise: Promise<void> | null = null;

export function isNativeCameraKitLinked(): boolean {
  return !!KidiCameraKit && typeof KidiCameraKit.initialize === "function";
}

export function isCameraKitSupported(): boolean {
  if (!hasSnapCameraKitConfig()) return false;
  if (Platform.OS === "web") return false;
  return isNativeCameraKitLinked();
}

async function ensureInitialized() {
  if (!KidiCameraKit) {
    throw new Error(
      "Module Camera Kit natif absent — rebuild l’app (expo prebuild + SDK Snap).",
    );
  }
  if (!initPromise) {
    initPromise = KidiCameraKit.initialize(snapApiToken(), SNAP_LENS_GROUP_IDS)
      .then(() => undefined)
      .catch((e) => {
        initPromise = null;
        throw e;
      });
  }
  await initPromise;
  return KidiCameraKit;
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
    if (KidiCameraKit) {
      try {
        await KidiCameraKit.clearLens();
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
  if (!KidiCameraKit) return;
  try {
    await KidiCameraKit.clearLens();
  } catch {
    /* ignore */
  }
}

export async function startBridgePreview(facing: "user" | "environment") {
  const mod = await ensureInitialized();
  // Snap Camera Kit gère le miroir de la caméra frontale en interne.
  // Ne pas passer mirrored=true → ça créerait un double miroir.
  await mod.startPreview(false, facing);
}

export async function stopBridgePreview() {
  if (!KidiCameraKit) return;
  try {
    await KidiCameraKit.stopPreview();
  } catch {
    /* ignore */
  }
}

export async function setBridgePublishEnabled(opts: {
  enabled: boolean;
  roomUrl?: string;
  token?: string;
}) {
  const mod = await ensureInitialized();
  await mod.setPublishEnabled(opts.enabled, opts.roomUrl ?? null, opts.token ?? null);
}
