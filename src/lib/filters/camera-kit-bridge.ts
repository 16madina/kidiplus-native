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

function mapBridgeLenses(rows: Array<{
  id?: unknown;
  groupId?: unknown;
  name?: unknown;
  iconUrl?: unknown;
  previewUrl?: unknown;
}>): BridgeLens[] {
  return rows
    .filter((row) => typeof row.id === "string" && row.id.length > 0)
    .map((row) => ({
      lensId: String(row.id),
      groupId: typeof row.groupId === "string" && row.groupId ? row.groupId : SNAP_LENS_GROUP_ID,
      name: typeof row.name === "string" && row.name ? row.name : "Lens",
      iconUrl: typeof row.iconUrl === "string" ? row.iconUrl : undefined,
      previewUrl: typeof row.previewUrl === "string" ? row.previewUrl : undefined,
    }));
}

/** Snap sends a lens group in waves. Keep the carousel synced after the
 * initial `loadLenses()` promise has already resolved. */
export function subscribeBridgeLensesUpdated(
  listener: (lenses: BridgeLens[]) => void,
): () => void {
  if (!KidiCameraKit?.addListener) return () => {};
  const sub = KidiCameraKit.addListener("status", (payload) => {
    if (payload.phase !== "lensesUpdated" || !Array.isArray(payload.lenses)) return;
    const rows = mapBridgeLenses(payload.lenses as Array<Record<string, unknown>>);
    if (rows.length === 0) return;
    lensesCache = rows;
    listener(rows);
  });
  return () => sub.remove();
}

export async function loadBridgeLenses(force = false): Promise<BridgeLens[]> {
  if (!force && lensesCache) return lensesCache;
  const mod = await ensureInitialized();
  const res = await mod.loadLenses(SNAP_LENS_GROUP_IDS);
  lensesCache = mapBridgeLenses(res.lenses ?? []);
  console.log(
    `[filters] Camera Kit ${lensesCache.length} lens(es)`,
    lensesCache.map((l) => l.name),
  );
  return lensesCache;
}

/** During a LiveKit publish, Snap must not grab the camera (it kills the room). */
let nativeLensApplyAllowed = true;

export function setNativeLensApplyAllowed(allowed: boolean): void {
  nativeLensApplyAllowed = allowed;
}

export function isNativeLensApplyAllowed(): boolean {
  return nativeLensApplyAllowed;
}

export async function applyBridgeLens(lens: Pick<Lens, "lensId" | "groupId" | "isSnapLens">) {
  if (!nativeLensApplyAllowed) return;
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
  if (!nativeLensApplyAllowed) return;
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

/** Mute/unmute video while keeping the native LiveKit publisher connected. */
export async function setBridgeCameraEnabled(enabled: boolean): Promise<void> {
  const mod = await ensureInitialized();
  await mod.setCameraEnabled(enabled);
}

/** Mute/unmute the microphone on the existing native LiveKit publisher. */
export async function setBridgeMicrophoneEnabled(enabled: boolean): Promise<void> {
  const mod = await ensureInitialized();
  await mod.setMicrophoneEnabled(enabled);
}

export function canUseNativeBattleGuestPublish(): boolean {
  return typeof KidiCameraKit?.setBattleGuestPublishEnabled === "function";
}

export async function setBridgeBattleGuestPublishEnabled(opts: {
  enabled: boolean;
  roomUrl?: string;
  token?: string;
}): Promise<{ enabled: boolean }> {
  const mod = await ensureInitialized();
  if (typeof mod.setBattleGuestPublishEnabled !== "function") {
    throw new Error("Battle guest native publish missing — rebuild iOS");
  }
  return mod.setBattleGuestPublishEnabled(
    opts.enabled,
    opts.roomUrl ?? null,
    opts.token ?? null,
  );
}

export async function flipBridgeCamera(): Promise<{ flipped: boolean; facing: string } | null> {
  if (!KidiCameraKit) return null;
  try {
    const mod = await ensureInitialized();
    return await mod.flipCamera();
  } catch {
    return null;
  }
}
