export const MAX_PUBLISH_VIDEO_SEC = 60;
export const MAX_STORY_VIDEO_SEC = 15;
export const MIN_CLIP_SEC = 1;
export const CROP_SCALE_MIN = 1;
export const CROP_SCALE_MAX = 4;
export const VIDEO_CLIP_PREFIX = "[kidiVideoClip]";
export const STORY_CLIP_PREFIX = "kidiClip:";

export type VideoClip = {
  startSec: number;
  endSec: number;
};

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export type CoverTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

export function maxVideoSecForMode(mode: "video" | "photo" | "story"): number {
  return mode === "story" ? MAX_STORY_VIDEO_SEC : MAX_PUBLISH_VIDEO_SEC;
}

export function pickerDurationToSec(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  // expo-image-picker documents video duration in milliseconds.
  return raw / 1000;
}

export function formatClock(sec: number): string {
  const n = Math.max(0, Math.floor(sec + 1e-6));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function coverBaseScale(imageW: number, imageH: number, viewW: number, viewH: number): number {
  "worklet";
  if (imageW <= 0 || imageH <= 0 || viewW <= 0 || viewH <= 0) return 1;
  return Math.max(viewW / imageW, viewH / imageH);
}

export function clampCoverTransform(args: {
  imageW: number;
  imageH: number;
  viewW: number;
  viewH: number;
  scale: number;
  translateX: number;
  translateY: number;
}): CoverTransform {
  "worklet";
  const scale = Math.min(CROP_SCALE_MAX, Math.max(CROP_SCALE_MIN, args.scale));
  const base = coverBaseScale(args.imageW, args.imageH, args.viewW, args.viewH);
  const total = base * scale;
  const dw = args.imageW * total;
  const dh = args.imageH * total;
  const maxX = Math.max(0, (dw - args.viewW) / 2);
  const maxY = Math.max(0, (dh - args.viewH) / 2);
  return {
    scale,
    translateX: Math.min(maxX, Math.max(-maxX, args.translateX)),
    translateY: Math.min(maxY, Math.max(-maxY, args.translateY)),
  };
}

export function cropRectFromCoverTransform(args: {
  imageW: number;
  imageH: number;
  viewW: number;
  viewH: number;
  scale: number;
  translateX: number;
  translateY: number;
}): CropRect {
  const { imageW, imageH, viewW, viewH } = args;
  const t = clampCoverTransform(args);
  const total = coverBaseScale(imageW, imageH, viewW, viewH) * t.scale;
  const dw = imageW * total;
  const dh = imageH * total;
  const imageLeft = viewW / 2 + t.translateX - dw / 2;
  const imageTop = viewH / 2 + t.translateY - dh / 2;
  let originX = (0 - imageLeft) / total;
  let originY = (0 - imageTop) / total;
  let width = viewW / total;
  let height = viewH / total;
  if (originX < 0) {
    width += originX;
    originX = 0;
  }
  if (originY < 0) {
    height += originY;
    originY = 0;
  }
  if (originX + width > imageW) width = imageW - originX;
  if (originY + height > imageH) height = imageH - originY;
  return {
    originX: Math.max(0, originX),
    originY: Math.max(0, originY),
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

export function initialTrimWindow(durationSec: number, maxSec: number): VideoClip {
  const dur = Math.max(0, durationSec);
  const end = Math.min(dur, Math.max(MIN_CLIP_SEC, maxSec));
  return { startSec: 0, endSec: end > 0 ? end : Math.min(maxSec, MIN_CLIP_SEC) };
}

export function clampTrimRange(
  durationSec: number,
  startSec: number,
  endSec: number,
  maxSec: number,
  minSec = MIN_CLIP_SEC,
): VideoClip {
  const dur = Math.max(0, durationSec);
  if (dur <= 0) return { startSec: 0, endSec: 0 };
  const maxWin = Math.min(maxSec, dur);
  const minWin = Math.min(Math.max(0.2, minSec), maxWin);
  let start = startSec;
  let end = endSec;
  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end)) end = maxWin;
  if (end < start) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  let width = end - start;
  if (width > maxWin) {
    width = maxWin;
    end = start + width;
  }
  if (width < minWin) {
    width = minWin;
    end = start + width;
  }
  if (end > dur) {
    end = dur;
    start = Math.max(0, end - width);
  }
  if (start < 0) {
    start = 0;
    end = Math.min(dur, start + width);
  }
  if (end - start > maxWin) start = end - maxWin;
  if (end - start < minWin && dur >= minWin) {
    end = Math.min(dur, start + minWin);
    start = Math.max(0, end - minWin);
  }
  return { startSec: start, endSec: end };
}

export function moveTrimWindow(
  durationSec: number,
  startSec: number,
  endSec: number,
  deltaSec: number,
  maxSec: number,
): VideoClip {
  return clampTrimRange(durationSec, startSec + deltaSec, endSec + deltaSec, maxSec);
}

export function resizeTrimStart(
  durationSec: number,
  startSec: number,
  endSec: number,
  nextStart: number,
  maxSec: number,
): VideoClip {
  const dur = Math.max(0, durationSec);
  const maxWin = Math.min(maxSec, dur);
  if (dur > maxSec) {
    const start = Math.min(Math.max(0, nextStart), Math.max(0, dur - maxWin));
    return { startSec: start, endSec: start + maxWin };
  }
  return clampTrimRange(durationSec, nextStart, endSec, maxSec);
}

export function resizeTrimEnd(
  durationSec: number,
  startSec: number,
  endSec: number,
  nextEnd: number,
  maxSec: number,
): VideoClip {
  const dur = Math.max(0, durationSec);
  const maxWin = Math.min(maxSec, dur);
  if (dur > maxSec) {
    const end = Math.min(dur, Math.max(maxWin, nextEnd));
    return { startSec: end - maxWin, endSec: end };
  }
  return clampTrimRange(durationSec, startSec, nextEnd, maxSec);
}

export function videoNeedsForcedTrim(durationSec: number, maxSec: number): boolean {
  return durationSec > maxSec + 0.08;
}

export function shouldPersistClip(clip: VideoClip, durationSec: number): boolean {
  return clip.startSec > 0.08 || clip.endSec < durationSec - 0.08;
}

export function encodeVideoClipCaption(text: string, clip: VideoClip | null, durationSec?: number): string {
  const body = text.trim();
  if (!clip) return body;
  if (durationSec != null && !shouldPersistClip(clip, durationSec)) return body;
  return `${VIDEO_CLIP_PREFIX}${JSON.stringify({
    startSec: Number(clip.startSec.toFixed(3)),
    endSec: Number(clip.endSec.toFixed(3)),
  })}\n${body}`;
}

export function parseVideoClipCaption(caption: string | null | undefined): {
  text: string;
  clip: VideoClip | null;
} {
  if (!caption) return { text: "", clip: null };
  if (!caption.startsWith(VIDEO_CLIP_PREFIX)) return { text: caption, clip: null };
  const rest = caption.slice(VIDEO_CLIP_PREFIX.length);
  const nl = rest.indexOf("\n");
  const jsonPart = nl >= 0 ? rest.slice(0, nl) : rest;
  const text = nl >= 0 ? rest.slice(nl + 1) : "";
  try {
    const raw = JSON.parse(jsonPart) as { startSec?: number; endSec?: number };
    const startSec = Number(raw.startSec);
    const endSec = Number(raw.endSec);
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
      return { text, clip: null };
    }
    return { text, clip: { startSec, endSec } };
  } catch {
    return { text: caption, clip: null };
  }
}

export function displayVitrineCaption(caption: string | null | undefined): string {
  return parseVideoClipCaption(caption).text;
}

export function encodeStoryPosterClip(posterUrl: string | null | undefined, clip: VideoClip | null): string | null {
  if (!clip) return posterUrl?.trim() || null;
  const payload = `${STORY_CLIP_PREFIX}${clip.startSec.toFixed(3)}:${clip.endSec.toFixed(3)}`;
  const poster = posterUrl?.trim();
  return poster ? `${payload}|${poster}` : payload;
}

export function parseStoryPosterClip(value: string | null | undefined): {
  posterUrl: string | null;
  clip: VideoClip | null;
} {
  if (!value) return { posterUrl: null, clip: null };
  if (!value.startsWith(STORY_CLIP_PREFIX)) return { posterUrl: value, clip: null };
  const rest = value.slice(STORY_CLIP_PREFIX.length);
  const bar = rest.indexOf("|");
  const head = bar >= 0 ? rest.slice(0, bar) : rest;
  const posterUrl = bar >= 0 ? rest.slice(bar + 1).trim() || null : null;
  const [a, b] = head.split(":");
  const startSec = Number(a);
  const endSec = Number(b);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
    return { posterUrl, clip: null };
  }
  return { posterUrl, clip: { startSec, endSec } };
}

export function isVideoMediaUrl(url: string, mediaType?: string | null): boolean {
  if (mediaType === "video") return true;
  const clean = url.split("#")[0];
  return /\.(mp4|mov|webm|m4v|m3u8)(\?|$)/i.test(clean) || /video\//i.test(clean);
}
