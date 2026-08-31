// Musique Vitrine : bibliothèque KiDi+ (même pistes que le site) + import.
// On stocke l'URL + les volumes et on la joue en lecture (modèle TikTok).

export type VitrineMusic = {
  url: string;
  title: string | null;
  artist: string | null;
  startSec: number;
  volume: number;
  originalVolume: number;
};

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  url: string;
  mood: string;
};

const MUSIC_CDN = "https://kidiplus.com/__l5e/assets-v1";

export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    id: "afro-sunset",
    title: "Afro Sunset",
    artist: "KiDi+ Studio",
    url: `${MUSIC_CDN}/f7833375-fea2-4499-971d-d5be103813e0/afro-sunset.mp3`,
    mood: "afro",
  },
  {
    id: "gold-nights",
    title: "Gold Nights",
    artist: "KiDi+ Studio",
    url: `${MUSIC_CDN}/4353c1b9-2e9f-4b61-b33b-2868b579d022/gold-nights.mp3`,
    mood: "house",
  },
  {
    id: "soft-glow",
    title: "Soft Glow",
    artist: "KiDi+ Studio",
    url: `${MUSIC_CDN}/4aeffdcd-09ce-4ce2-b7ea-13c44bd2f5b0/soft-glow.mp3`,
    mood: "chill",
  },
  {
    id: "market-day",
    title: "Market Day",
    artist: "KiDi+ Studio",
    url: `${MUSIC_CDN}/e0493587-f327-440c-a5d1-e06ed80d2a42/market-day.mp3`,
    mood: "pop",
  },
  {
    id: "slow-motion",
    title: "Slow Motion",
    artist: "KiDi+ Studio",
    url: `${MUSIC_CDN}/5a1cefdc-6c69-41ba-9b9e-a90b04847994/slow-motion.mp3`,
    mood: "cinematic",
  },
  {
    id: "runway",
    title: "Runway",
    artist: "KiDi+ Studio",
    url: `${MUSIC_CDN}/2f76b67c-64fd-4c04-b81e-5297968ded35/runway.mp3`,
    mood: "fashion",
  },
];

export const MAX_MUSIC_BYTES = 15 * 1024 * 1024;

export const AUDIO_EXT =
  /\.(mp3|m4a|mp4a|aac|wav|wave|ogg|oga|opus|flac|aiff|aif|caf|amr|3gp|weba|webm)$/i;

export function isAudioName(name: string, mime?: string | null): boolean {
  if (mime?.startsWith("audio/") || mime === "application/ogg") return true;
  return AUDIO_EXT.test(name);
}

export function defaultMusicFor(track: { url: string; title?: string; artist?: string }): VitrineMusic {
  return {
    url: track.url,
    title: track.title ?? null,
    artist: track.artist ?? null,
    startSec: 0,
    volume: 0.8,
    originalVolume: 0.2,
  };
}

export function musicFromRow(r: {
  music_url?: string | null;
  music_title?: string | null;
  music_artist?: string | null;
  music_start_sec?: number | string | null;
  music_volume?: number | string | null;
  original_volume?: number | string | null;
}): VitrineMusic | null {
  const hasOriginal = r?.original_volume != null && Number(r.original_volume) < 1;
  if (!r?.music_url && !hasOriginal) return null;
  return {
    url: r.music_url ?? "",
    title: r.music_title ?? null,
    artist: r.music_artist ?? null,
    startSec: Number(r.music_start_sec ?? 0) || 0,
    volume: clamp01(Number(r.music_volume ?? 0.8)),
    originalVolume: clamp01(Number(r.original_volume ?? 1)),
  };
}

export function musicToRow(music?: VitrineMusic | null) {
  if (!music) return {};
  if (!music.url) return { original_volume: clamp01(music.originalVolume) };
  return {
    music_url: music.url,
    music_title: music.title,
    music_artist: music.artist,
    music_start_sec: Math.max(0, music.startSec || 0),
    music_volume: clamp01(music.volume),
    original_volume: clamp01(music.originalVolume),
  };
}

export const MUSIC_COLUMNS =
  "music_url, music_title, music_artist, music_start_sec, music_volume, original_volume";

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function musicLabel(music: VitrineMusic | null | undefined): string | null {
  if (!music?.url && !music?.title) return null;
  const title = music.title?.trim();
  const artist = music.artist?.trim();
  if (title && artist) return `${title} · ${artist}`;
  return title || artist || "Musique";
}
