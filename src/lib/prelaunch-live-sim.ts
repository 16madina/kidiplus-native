import { supabase } from "./supabase";

export const PRELAUNCH_LIVE_SIM_CONFIG_KEY = "prelaunch_live_sim";

export type PrelaunchLiveSimConfig = {
  enabled: boolean;
  viewersMin: number;
  viewersMax: number;
  commentEverySecMin: number;
  commentEverySecMax: number;
  fakeBids: boolean;
  bidEverySecMin: number;
  bidEverySecMax: number;
  heartChancePct: number;
};

export const DEFAULT_PRELAUNCH_LIVE_SIM: PrelaunchLiveSimConfig = {
  enabled: false,
  viewersMin: 50,
  viewersMax: 160,
  commentEverySecMin: 1,
  commentEverySecMax: 3,
  fakeBids: true,
  bidEverySecMin: 1,
  bidEverySecMax: 3,
  heartChancePct: 18,
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function clampBool(n: unknown, fallback: boolean): boolean {
  if (typeof n === "boolean") return n;
  if (n === 1 || n === "1" || n === "true" || n === "on") return true;
  if (n === 0 || n === "0" || n === "false" || n === "off") return false;
  return fallback;
}

function envOverride(): boolean | null {
  const env = String(process.env.EXPO_PUBLIC_PRELAUNCH_LIVE_SIM ?? "").trim();
  if (env === "0" || env.toLowerCase() === "false") return false;
  if (env === "1" || env.toLowerCase() === "true") return true;
  return null;
}

/** Normalize any stored payload (legacy "0"/"1" or partial JSON). */
export function parsePrelaunchLiveSimConfig(raw: string | null | undefined): PrelaunchLiveSimConfig {
  const d = DEFAULT_PRELAUNCH_LIVE_SIM;
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ...d };

  if (trimmed === "0" || trimmed.toLowerCase() === "false" || trimmed === "off") {
    return { ...d, enabled: false };
  }
  if (trimmed === "1" || trimmed.toLowerCase() === "true" || trimmed === "on") {
    return { ...d, enabled: true };
  }

  try {
    const j = JSON.parse(trimmed) as Partial<PrelaunchLiveSimConfig>;
    let viewersMin = clampInt(j.viewersMin, 1, 5000, d.viewersMin);
    let viewersMax = clampInt(j.viewersMax, 1, 5000, d.viewersMax);
    if (viewersMax < viewersMin) {
      const t = viewersMin;
      viewersMin = viewersMax;
      viewersMax = t;
    }
    let commentEverySecMin = clampInt(j.commentEverySecMin, 1, 120, d.commentEverySecMin);
    let commentEverySecMax = clampInt(j.commentEverySecMax, 1, 120, d.commentEverySecMax);
    if (commentEverySecMax < commentEverySecMin) {
      const t = commentEverySecMin;
      commentEverySecMin = commentEverySecMax;
      commentEverySecMax = t;
    }
    let bidEverySecMin = clampInt(j.bidEverySecMin, 1, 120, d.bidEverySecMin);
    let bidEverySecMax = clampInt(j.bidEverySecMax, 1, 120, d.bidEverySecMax);
    if (bidEverySecMax < bidEverySecMin) {
      const t = bidEverySecMin;
      bidEverySecMin = bidEverySecMax;
      bidEverySecMax = t;
    }
    return {
      enabled: clampBool(j.enabled, d.enabled),
      viewersMin,
      viewersMax,
      commentEverySecMin,
      commentEverySecMax,
      fakeBids: clampBool(j.fakeBids, d.fakeBids),
      bidEverySecMin,
      bidEverySecMax,
      heartChancePct: clampInt(j.heartChancePct, 0, 100, d.heartChancePct),
    };
  } catch {
    return { ...d };
  }
}

function withEnvOverride(cfg: PrelaunchLiveSimConfig): PrelaunchLiveSimConfig {
  const forced = envOverride();
  if (forced === null) return cfg;
  return { ...cfg, enabled: forced };
}

function asRaw(data: unknown): string | null {
  if (data == null) return null;
  return typeof data === "string" ? data : String(data);
}

async function fetchStoredPrelaunchLiveSimConfig(): Promise<PrelaunchLiveSimConfig> {
  try {
    const { data, error } = await supabase.rpc("get_prelaunch_live_sim");
    if (!error && data != null) {
      return parsePrelaunchLiveSimConfig(asRaw(data));
    }
  } catch {
    /* fall through */
  }
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", PRELAUNCH_LIVE_SIM_CONFIG_KEY)
      .maybeSingle();
    if (error) throw error;
    return parsePrelaunchLiveSimConfig((data as { value?: string } | null)?.value);
  } catch {
    return { ...DEFAULT_PRELAUNCH_LIVE_SIM, enabled: false };
  }
}

export async function fetchPrelaunchLiveSimConfig(): Promise<PrelaunchLiveSimConfig> {
  return withEnvOverride(await fetchStoredPrelaunchLiveSimConfig());
}

/** Admin read: stored values without env override. */
export async function fetchPrelaunchLiveSimConfigForAdmin(): Promise<PrelaunchLiveSimConfig> {
  try {
    const { data, error } = await supabase.rpc("admin_get_prelaunch_live_sim");
    if (!error && data != null) {
      return parsePrelaunchLiveSimConfig(asRaw(data));
    }
  } catch {
    /* fall through */
  }
  return fetchStoredPrelaunchLiveSimConfig();
}

// ---------------------------------------------------------------------------
// Sim crowd engine (same names / lines / cadence as kidiplus.com)
// ---------------------------------------------------------------------------

const SIM_PREFIX = "sim:";

export function isSimBidderId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(SIM_PREFIX);
}

export function simBidderId(name: string): string {
  return `${SIM_PREFIX}${name}`;
}

const NAMES = [
  "aicha_ci", "koffi.95", "mariam", "julien_paris", "fatou", "yanis75",
  "lea_style", "moussa.k", "ines.mrl", "adama", "chloe_x", "ibrahim",
  "sarah.m", "nana_abj", "thomas.b", "aminata", "hugo_j", "seydou",
  "camille_r", "awa.d", "sofiane", "keira", "mehdi.k", "yasmine",
  "romain", "diarra", "elodie", "bakary", "manon", "lamine",
  "victoire", "ousmane", "louise", "nadia_sn", "raphael", "binta",
  "farah", "cheikh", "margaux", "youssouf", "sabrina", "awa_live",
  "noa93", "khadija", "bilel", "zoe.lyon", "ismael", "myriam",
];

const CHAT = [
  "trop belle 😍", "je prends !", "prix ?", "gooo", "🔥🔥🔥",
  "taille 40 dispo ?", "il reste en M ?", "authentique ?", "c'est neuf ?",
  "envoie sur Paris ?", "combien la livraison ?", "je suis fan ❤️",
  "hâte de voir !", "top qualité", "montre encore stp", "propre",
  "chaud", "j'aime beaucoup", "tu fais des lots ?", "possible en 42 ?",
  "je viens d'arriver 👋", "salut tout le monde", "wesh", "MDR",
  "livré sous combien de jours ?", "tu prends PayPal ?", "j'attends la suite",
  "elle est canon", "last one ?", "je valide", "Abidjan aussi ?",
  "Cocody on est là", "force 💪", "c'est cadeau ou quoi 😂", "encore une !",
  "le live est chaud ce soir", "qui mène ?", "allez on surenchérit",
  "c'est quelle marque ?", "tu as d'autres couleurs ?", "stock limité ?",
  "tu livres en France ?", "et en Côte d'Ivoire ?", "frais de port ?",
  "ça fait quelle taille réel ?", "neuf ou recond ?", "tu peux zoomer ?",
  "il reste combien ?", "prochaine pièce c'est quoi ?", "tu démarres à combien ?",
];

const BID_CHAT = [
  "je surenchéris", "prend ça", "+1", "go enchère", "c'est à moi",
  "personne bouge 😤", "encore", "je relance", "allez 🔥", "moi je prends",
  "dernière chance les gens", "trop beau pour passer", "j'enchéris",
];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: readonly T[]): T => arr[rand(arr.length)]!;

function randBetweenSec(minSec: number, maxSec: number): number {
  const a = Math.min(minSec, maxSec);
  const b = Math.max(minSec, maxSec);
  return (a + Math.random() * (b - a)) * 1000;
}

export function randomSimName(): string {
  return pick(NAMES);
}

export function randomSimChat(auctionHot: boolean): { name: string; text: string; join: boolean } {
  if (Math.random() < 0.14) {
    const name = randomSimName();
    return { name, text: name, join: true };
  }
  const name = randomSimName();
  const pool = auctionHot && Math.random() < 0.55 ? BID_CHAT : CHAT;
  return { name, text: pick(pool), join: false };
}

export function nextSimViewerCount(
  prev: number,
  dir: 1 | -1,
  viewersMin: number,
  viewersMax: number,
): { count: number; dir: 1 | -1 } {
  const lo = Math.min(viewersMin, viewersMax);
  const hi = Math.max(viewersMin, viewersMax);
  const span = Math.max(1, hi - lo);

  // Small natural steps: usually 1–3, occasional 4–8 burst.
  const roll = Math.random();
  let step: number;
  if (roll < 0.5) step = 1;
  else if (roll < 0.78) step = 2;
  else if (roll < 0.9) step = 3;
  else step = 4 + rand(5);

  let nextDir: 1 | -1 = dir;
  // Flip more often near the edges so the count waves instead of climbing.
  const nearLow = (prev - lo) / span < 0.18;
  const nearHigh = (hi - prev) / span < 0.18;
  const flipChance = nearLow || nearHigh ? 0.28 : 0.12;
  if (Math.random() < flipChance) nextDir = dir === 1 ? -1 : 1;
  if (prev <= lo + 1) nextDir = 1;
  if (prev >= hi - 1) nextDir = -1;

  let count = prev + nextDir * step;
  if (count > hi) {
    count = hi - rand(3);
    nextDir = -1;
  }
  if (count < lo) {
    count = lo + rand(3);
    nextDir = 1;
  }
  return { count, dir: nextDir };
}

/** Start at the admin minimum (plus 0–2) so the crowd fills in gradually. */
export function initialSimViewerCount(viewersMin: number, viewersMax: number): number {
  const lo = Math.min(viewersMin, viewersMax);
  const hi = Math.max(viewersMin, viewersMax);
  return Math.min(hi, lo + rand(3));
}

export function nextCommentDelayMs(cfg: PrelaunchLiveSimConfig): number {
  return randBetweenSec(cfg.commentEverySecMin, cfg.commentEverySecMax);
}

export function nextBidDelayMs(cfg: PrelaunchLiveSimConfig): number {
  return randBetweenSec(cfg.bidEverySecMin, cfg.bidEverySecMax);
}

/** Slightly calmer cadence so each +1 / +2 is readable on camera. */
export function nextViewerTickMs(): number {
  return 1800 + Math.random() * 2200;
}

export async function savePrelaunchLiveSimConfig(
  input: PrelaunchLiveSimConfig,
): Promise<PrelaunchLiveSimConfig> {
  const toStore = parsePrelaunchLiveSimConfig(JSON.stringify(input));
  const payload = JSON.stringify(toStore);

  const rpc = await supabase.rpc("admin_set_prelaunch_live_sim", { _value: payload });
  if (!rpc.error && rpc.data != null) {
    return parsePrelaunchLiveSimConfig(asRaw(rpc.data));
  }

  const up = await supabase.from("app_config").upsert(
    {
      key: PRELAUNCH_LIVE_SIM_CONFIG_KEY,
      value: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (up.error) {
    throw new Error(
      rpc.error?.message || up.error.message || "Échec d’enregistrement (migration Simu manquante ?)",
    );
  }
  const verify = await supabase
    .from("app_config")
    .select("value")
    .eq("key", PRELAUNCH_LIVE_SIM_CONFIG_KEY)
    .maybeSingle();
  if (verify.error) throw new Error(verify.error.message);
  const raw = (verify.data as { value?: string } | null)?.value ?? null;
  if (raw == null) throw new Error("La base n’a pas renvoyé la config enregistrée.");
  return parsePrelaunchLiveSimConfig(raw);
}
