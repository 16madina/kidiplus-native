// Admin push broadcast — calls the same TanStack serverFn as kidiplus.com AdminPushPanel.
import { supabase } from "./supabase";

const API_BASE = "https://kidiplus.com";
/** Stable function id from the deployed kidiplus.com bundle (`sendAdminPush`). */
const SEND_ADMIN_PUSH_FN =
  "90b1bbad17730bbf9d00e56dee3118020700fb64622af817593182b8a8b55a2c";

export type AdminPushInput = {
  mode: "all" | "user_ids";
  userIds?: string[];
  title: string;
  body: string;
};

export type AdminPushResult = {
  targetedUsers: number;
  sent: number;
  failed: number;
  invalidTokens: number;
};

/** Minimal seroval encode for a plain JSON-like object graph (strings / numbers / arrays / records). */
function serovalEncode(value: unknown, refs: Map<object, number> = new Map(), nextId = { n: 0 }): unknown {
  if (value === null) return { t: 0 };
  if (typeof value === "string") return { t: 1, s: value };
  if (typeof value === "boolean") return { t: 2, s: value ? 1 : 0 };
  if (typeof value === "number") return { t: 3, s: value };
  if (Array.isArray(value)) {
    if (refs.has(value)) return { t: 8, i: refs.get(value)! };
    const i = nextId.n++;
    refs.set(value, i);
    return {
      t: 9,
      i,
      a: value.map((v) => serovalEncode(v, refs, nextId)),
      o: 0,
    };
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (refs.has(obj)) return { t: 8, i: refs.get(obj)! };
    const i = nextId.n++;
    refs.set(obj, i);
    const k = Object.keys(obj);
    return {
      t: 10,
      i,
      p: { k, v: k.map((key) => serovalEncode(obj[key], refs, nextId)) },
      o: 0,
    };
  }
  throw new Error("unsupported_seroval_value");
}

function serovalDecode(node: unknown, refs: Map<number, unknown> = new Map()): unknown {
  if (!node || typeof node !== "object") return node;
  const n = node as Record<string, unknown>;
  const t = n.t;
  if (t === 0) return null;
  if (t === 1) return n.s;
  if (t === 2) return n.s === 1;
  if (t === 3) return n.s;
  if (t === 8) return refs.get(n.i as number);
  if (t === 9) {
    const arr: unknown[] = [];
    refs.set(n.i as number, arr);
    const a = (n.a as unknown[]) ?? [];
    for (const item of a) arr.push(serovalDecode(item, refs));
    return arr;
  }
  if (t === 10) {
    const obj: Record<string, unknown> = {};
    refs.set(n.i as number, obj);
    const p = n.p as { k?: string[]; v?: unknown[] } | undefined;
    const keys = p?.k ?? [];
    const vals = p?.v ?? [];
    for (let i = 0; i < keys.length; i++) {
      obj[keys[i]!] = serovalDecode(vals[i], refs);
    }
    return obj;
  }
  if (t === 25) {
    const s = n.s as { message?: unknown } | undefined;
    const msg = s?.message ? String(serovalDecode(s.message, refs)) : "server_error";
    throw new Error(msg);
  }
  return node;
}

function wrapPayload(data: AdminPushInput): string {
  // Matches TanStack Start client: serialize({ data }) then JSON.stringify.
  const inner = serovalEncode({ data });
  return JSON.stringify({ t: inner, f: 127, m: [] });
}

export async function sendAdminPush(input: AdminPushInput): Promise<AdminPushResult> {
  const title = (input.title ?? "").trim();
  const body = (input.body ?? "").trim();
  if (!title && !body) throw new Error("Le titre ou le message est requis");

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("not_signed_in");

  const res = await fetch(`${API_BASE}/_serverFn/${SEND_ADMIN_PUSH_FN}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-tss-framed, application/x-ndjson, application/json",
      "x-tsr-serverFn": "true",
      Authorization: `Bearer ${token}`,
      Origin: "https://kidiplus.com",
    },
    body: wrapPayload({
      mode: input.mode,
      userIds: input.mode === "user_ids" ? input.userIds : undefined,
      title,
      body,
    }),
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!json) throw new Error(`http_${res.status}`);

  // Success shape: { t:10, p:{ k:['result','error','context'], v:[result, error, context] } }
  try {
    const decoded = serovalDecode(json) as {
      result?: AdminPushResult | null;
      error?: unknown;
    };
    if (decoded && typeof decoded === "object" && "result" in decoded) {
      if (decoded.error) {
        const err = decoded.error;
        throw new Error(err instanceof Error ? err.message : String(err));
      }
      const r = decoded.result;
      if (!r) throw new Error("empty_result");
      return {
        targetedUsers: Number(r.targetedUsers ?? 0),
        sent: Number(r.sent ?? 0),
        failed: Number(r.failed ?? 0),
        invalidTokens: Number(r.invalidTokens ?? 0),
      };
    }
  } catch (e) {
    if (e instanceof Error && e.message !== "empty_result") throw e;
  }

  // Fallback: some deployments return the result object directly.
  const direct = json as Partial<AdminPushResult>;
  if (typeof direct.sent === "number") {
    return {
      targetedUsers: Number(direct.targetedUsers ?? 0),
      sent: Number(direct.sent ?? 0),
      failed: Number(direct.failed ?? 0),
      invalidTokens: Number(direct.invalidTokens ?? 0),
    };
  }

  throw new Error(`http_${res.status}`);
}
