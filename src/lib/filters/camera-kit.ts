// Snap Camera Kit config for KiDi+ native (Expo).
// API tokens are public client tokens (same as Capacitor / Info.plist).

const EMBEDDED_API_TOKEN =
  "eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzg0MDQzNzkxLCJzdWIiOiIxOWJhOGM5OC1jMDRhLTRlOTgtOGVkYi04YWM4ZDQyODUzMzN-UFJPRFVDVElPTn43OTRjMjZhNC02ZDg0LTQ5NGYtOGE4Ny04MmZkMmVkZDVmYTUifQ.YE50FTWYfbngNKJGigMDb-I_eVvfASwRF9NRsQ4MD_4";

const EMBEDDED_LENS_GROUP_ID = "df287f43-6646-4b01-a711-1a0e632c211a";
const EMBEDDED_LENS_GROUP_IDS_ALL = [
  "df287f43-6646-4b01-a711-1a0e632c211a",
  "5b22f85d-3308-452f-8bcc-058a5c9dc34b",
];

function readEnv(key: string): string {
  try {
    const v = (process.env as Record<string, string | undefined>)[key];
    return (v ?? "").trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

/** Same production token as kidiplus.com Capacitor / Info.plist. */
export function snapApiToken(): string {
  return readEnv("EXPO_PUBLIC_SNAP_CAMERA_KIT_API_TOKEN") || EMBEDDED_API_TOKEN;
}

export function isSnapProductionToken(): boolean {
  const t = snapApiToken();
  const payload = t.split(".")[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return json.includes("~PRODUCTION~");
  } catch {
    return false;
  }
}

/** Primary Lens Group (KIDI+ production). */
export const SNAP_LENS_GROUP_ID =
  readEnv("EXPO_PUBLIC_SNAP_LENS_GROUP_ID") || EMBEDDED_LENS_GROUP_ID;

/** One or more groups — comma-separated env overrides. */
export const SNAP_LENS_GROUP_IDS: string[] = Array.from(
  new Set(
    [
      ...EMBEDDED_LENS_GROUP_IDS_ALL,
      ...readEnv("EXPO_PUBLIC_SNAP_LENS_GROUP_IDS")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ].filter(Boolean),
  ),
);

export function hasSnapCameraKitConfig(): boolean {
  return !!snapApiToken() && SNAP_LENS_GROUP_IDS.length > 0;
}
