import { SUPABASE_URL, supabase } from "./supabase";

export const STORAGE_BUCKETS = [
  "live-products",
  "live-covers",
  "shop-products",
  "avatars",
  "demo-covers",
  "vitrine-media",
] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/** Public buckets: `/object/public/` works. Private buckets must be signed. */
const PUBLIC_BUCKETS = new Set<StorageBucket>(["vitrine-media", "live-covers"]);

/** Media uploaded to an older Superbase project still point at this host. */
const LEGACY_STORAGE_HOSTS = ["https://rpersnzjidxtlekbbdtp.supabase.co"];

const signedCache = new Map<string, { url: string; expiresAt: number }>();
const SIGN_TTL_SEC = 60 * 60 * 22;

export function isHttpUrl(value: string | null | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

export function rewriteStorageHost(url: string): string {
  let out = url;
  for (const host of LEGACY_STORAGE_HOSTS) {
    if (out.startsWith(host)) out = SUPABASE_URL + out.slice(host.length);
  }
  return out;
}

export function parseSupabaseStorageUrl(
  value: string,
): { bucket: StorageBucket; path: string } | null {
  const trimmed = rewriteStorageHost(value.trim());
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  const match = trimmed.match(
    /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/([^/]+)\/([^?]+)/i,
  );
  if (!match?.[1] || !match?.[2]) return null;
  const bucket = decodeURIComponent(match[1]);
  if (!(STORAGE_BUCKETS as readonly string[]).includes(bucket)) return null;
  return { bucket: bucket as StorageBucket, path: decodeURIComponent(match[2]) };
}

export function stripBucketPrefix(path: string, bucket: string): string {
  const re = new RegExp(`^${bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`, "i");
  return path.replace(/^\/+/, "").replace(re, "");
}

function publicObjectUrl(bucket: StorageBucket, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function signObject(bucket: StorageBucket, path: string): Promise<string | null> {
  if (PUBLIC_BUCKETS.has(bucket)) {
    return publicObjectUrl(bucket, path);
  }
  const key = `${bucket}::${path}`;
  const cached = signedCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGN_TTL_SEC);
  if (!error && data?.signedUrl) {
    signedCache.set(key, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGN_TTL_SEC * 1000,
    });
    return data.signedUrl;
  }
  return null;
}

/**
 * Resolve a stored image to a displayable URL.
 * Absolute non-Superbase http(s) URLs are returned as-is.
 * Private buckets never fall back to `/object/public/` (that 400s).
 */
export async function resolveStoredImage(
  bucket: StorageBucket,
  value: string | null | undefined,
  fallbackBuckets: StorageBucket[] = [],
): Promise<string | null> {
  if (!value) return null;
  if (/^(blob:|data:)/i.test(value)) return value;

  let objectPath = value;
  let objectBucket: StorageBucket = bucket;
  if (/^https?:\/\//i.test(value)) {
    const parsed = parseSupabaseStorageUrl(value);
    if (!parsed) return rewriteStorageHost(value);
    objectBucket = parsed.bucket;
    objectPath = parsed.path;
  }
  objectPath = stripBucketPrefix(objectPath, objectBucket);

  const tryBuckets: StorageBucket[] = [objectBucket, ...fallbackBuckets.filter((b) => b !== objectBucket)];
  for (const b of tryBuckets) {
    const url = await signObject(b, objectPath);
    if (url) return url;
  }
  return null;
}

export async function resolveAvatarUrl(value: string | null | undefined): Promise<string> {
  return (await resolveStoredImage("avatars", value)) ?? "";
}
