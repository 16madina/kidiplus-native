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
