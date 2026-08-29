export type PosterMode = "off" | "cover";
export type BackgroundMode = "none" | "blur" | "image";
export type PosterTransform = { x: number; y: number; scale: number };

const DEFAULT_POSTER_TRANSFORM: PosterTransform = { x: 0.5, y: 0.4, scale: 1 };

function clampPosterTransform(t: PosterTransform): PosterTransform {
  return {
    x: Math.min(0.95, Math.max(0.05, Number.isFinite(t.x) ? t.x : DEFAULT_POSTER_TRANSFORM.x)),
    y: Math.min(0.95, Math.max(0.05, Number.isFinite(t.y) ? t.y : DEFAULT_POSTER_TRANSFORM.y)),
    scale: Math.min(
      3,
      Math.max(0.35, Number.isFinite(t.scale) ? t.scale : DEFAULT_POSTER_TRANSFORM.scale),
    ),
  };
}

export const LIVE_FX_TOPIC = "kidi-live-fx";
export const LIVE_FX_VERSION = 1;
export const LIVE_FX_HEARTBEAT_MS = 4_000;

export type LiveFxPayload = {
  v: typeof LIVE_FX_VERSION;
  posterUrl: string | null;
  posterMode: PosterMode;
  posterX: number;
  posterY: number;
  posterScale: number;
  backgroundMode: BackgroundMode;
  backgroundUrl: string | null;
  lensId: string;
  lensName: string;
  tint: string;
};

const POSTER_MODES = new Set<PosterMode>(["off", "cover"]);
const BACKGROUND_MODES = new Set<BackgroundMode>(["none", "blur", "image"]);

export const EMPTY_LIVE_FX: LiveFxPayload = {
  v: LIVE_FX_VERSION,
  posterUrl: null,
  posterMode: "off",
  posterX: DEFAULT_POSTER_TRANSFORM.x,
  posterY: DEFAULT_POSTER_TRANSFORM.y,
  posterScale: DEFAULT_POSTER_TRANSFORM.scale,
  backgroundMode: "none",
  backgroundUrl: null,
  lensId: "none",
  lensName: "",
  tint: "transparent",
};

export function isLocalImageUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return /^(file:|content:|ph:|assets-library:|blob:|data:)/i.test(uri);
}

export function isPublishableImageUrl(uri: string | null | undefined): uri is string {
  return !!uri && /^https:\/\//i.test(uri);
}

export function posterTransformOf(fx: LiveFxPayload): PosterTransform {
  return clampPosterTransform({
    x: fx.posterX,
    y: fx.posterY,
    scale: fx.posterScale,
  });
}

export function liveTintForLens(lens: {
  lensId: string;
  tint?: string;
  isSnapLens?: boolean;
}): string {
  const tint = (lens.tint ?? "").trim();
  if (tint && tint !== "transparent") return tint.slice(0, 64);
  if (lens.isSnapLens && lens.lensId !== "none") return "rgba(232,185,59,0.18)";
  return "transparent";
}

function clipStr(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function clipUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (isLocalImageUri(value)) return null;
  if (!/^https:\/\//i.test(value)) return null;
  return value.slice(0, 2_048);
}

export function sanitizeLiveFx(input: Partial<LiveFxPayload> | null | undefined): LiveFxPayload {
  const posterMode = POSTER_MODES.has(input?.posterMode as PosterMode)
    ? (input!.posterMode as PosterMode)
    : "off";
  const backgroundMode = BACKGROUND_MODES.has(input?.backgroundMode as BackgroundMode)
    ? (input!.backgroundMode as BackgroundMode)
    : "none";
  const transform = clampPosterTransform({
    x: Number(input?.posterX),
    y: Number(input?.posterY),
    scale: Number(input?.posterScale),
  });
  const posterUrl = clipUrl(input?.posterUrl);
  return {
    v: LIVE_FX_VERSION,
    posterUrl: posterMode === "off" ? null : posterUrl,
    posterMode: posterUrl ? posterMode : "off",
    posterX: transform.x,
    posterY: transform.y,
    posterScale: transform.scale,
    backgroundMode,
    backgroundUrl: backgroundMode === "image" ? clipUrl(input?.backgroundUrl) : null,
    lensId: clipStr(input?.lensId, 80) || "none",
    lensName: clipStr(input?.lensName, 40),
    tint: clipStr(input?.tint, 64) || "transparent",
  };
}

export function encodeLiveFx(payload: LiveFxPayload): Uint8Array<ArrayBuffer> {
  const json = JSON.stringify(sanitizeLiveFx(payload));
  return new TextEncoder().encode(json);
}

export function decodeLiveFx(data: Uint8Array | ArrayBuffer | string | null | undefined): LiveFxPayload | null {
  try {
    const text =
      typeof data === "string"
        ? data
        : new TextDecoder().decode(data instanceof Uint8Array ? data : new Uint8Array(data ?? []));
    if (!text || text.length > 8_192) return null;
    const parsed = JSON.parse(text) as Partial<LiveFxPayload> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.v != null && parsed.v !== LIVE_FX_VERSION) return null;
    return sanitizeLiveFx(parsed);
  } catch {
    return null;
  }
}

export function liveFxEquals(a: LiveFxPayload, b: LiveFxPayload): boolean {
  return (
    a.posterUrl === b.posterUrl &&
    a.posterMode === b.posterMode &&
    a.posterX === b.posterX &&
    a.posterY === b.posterY &&
    a.posterScale === b.posterScale &&
    a.backgroundMode === b.backgroundMode &&
    a.backgroundUrl === b.backgroundUrl &&
    a.lensId === b.lensId &&
    a.lensName === b.lensName &&
    a.tint === b.tint
  );
}

export function liveFxHasVisual(fx: LiveFxPayload): boolean {
  return (
    (fx.posterMode === "cover" && !!fx.posterUrl) ||
    fx.backgroundMode !== "none" ||
    (fx.tint !== "" && fx.tint !== "transparent")
  );
}
