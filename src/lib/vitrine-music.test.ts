import assert from "node:assert/strict";
import {
  clamp01,
  defaultMusicFor,
  isAudioName,
  MUSIC_LIBRARY,
  musicFromRow,
  musicLabel,
  musicToRow,
} from "./vitrine-music.ts";

async function run() {
  assert.equal(MUSIC_LIBRARY.length, 6);
  assert.ok(MUSIC_LIBRARY.every((t) => t.url.startsWith("https://kidiplus.com/")));
  assert.equal(isAudioName("beat.mp3"), true);
  assert.equal(isAudioName("photo.jpg"), false);
  assert.equal(isAudioName("voix", "audio/mpeg"), true);
  assert.equal(clamp01(1.4), 1);
  assert.equal(clamp01(-2), 0);

  const m = defaultMusicFor(MUSIC_LIBRARY[0]!);
  assert.equal(m.volume, 0.8);
  assert.equal(m.originalVolume, 0.2);
  const row = musicToRow(m);
  assert.equal(row.music_url, m.url);
  assert.equal(row.music_title, m.title);

  const parsed = musicFromRow({
    music_url: m.url,
    music_title: "Afro Sunset",
    music_artist: "KiDi+ Studio",
    music_start_sec: "2",
    music_volume: "0.5",
    original_volume: "0.1",
  });
  assert.ok(parsed);
  assert.equal(parsed?.startSec, 2);
  assert.equal(parsed?.volume, 0.5);
  assert.equal(musicLabel(parsed), "Afro Sunset · KiDi+ Studio");
  assert.equal(musicFromRow({}), null);
}

void run();
