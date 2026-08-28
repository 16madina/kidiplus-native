const {
  withInfoPlist,
  withAndroidManifest,
  withProjectBuildGradle,
  createRunOncePlugin,
} = require("expo/config-plugins");

const EMBEDDED_TOKEN =
  "eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzg0MDQzNzkxLCJzdWIiOiIxOWJhOGM5OC1jMDRhLTRlOTgtOGVkYi04YWM4ZDQyODUzMzN-UFJPRFVDVElPTn43OTRjMjZhNC02ZDg0LTQ5NGYtOGE4Ny04MmZkMmVkZDVmYTUifQ.YE50FTWYfbngNKJGigMDb-I_eVvfASwRF9NRsQ4MD_4";
const EMBEDDED_GROUP = "df287f43-6646-4b01-a711-1a0e632c211a";

function resolveToken(config) {
  return (
    process.env.EXPO_PUBLIC_SNAP_CAMERA_KIT_API_TOKEN ||
    config.extra?.snapCameraKitApiToken ||
    EMBEDDED_TOKEN
  );
}

function resolveGroup(config) {
  return (
    process.env.EXPO_PUBLIC_SNAP_LENS_GROUP_ID ||
    config.extra?.snapLensGroupId ||
    EMBEDDED_GROUP
  );
}

function withCameraKitIos(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.SCCameraKitAPIToken = resolveToken(config);
    config.modResults.SCCameraKitLensGroupID = resolveGroup(config);
    return config;
  });
}

function withCameraKitAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const token = resolveToken(config);
    const app = config.modResults.manifest.application?.[0];
    if (!app) return config;
    app["meta-data"] = app["meta-data"] || [];
    const metas = app["meta-data"];
    const existing = metas.find(
      (m) => m.$?.["android:name"] === "com.snap.camerakit.api.token",
    );
    if (existing) {
      existing.$["android:value"] = token;
    } else {
      metas.push({
        $: {
          "android:name": "com.snap.camerakit.api.token",
          "android:value": token,
        },
      });
    }
    return config;
  });
}

/** LiveKit Android pulls audioswitch from JitPack. */
function withJitpack(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;
    const contents = config.modResults.contents;
    if (contents.includes("jitpack.io")) return config;
    config.modResults.contents = contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      (match) => `${match}\n        maven { url 'https://jitpack.io' }`,
    );
    // Expo SDK 50+ often uses settings.gradle dependencyResolutionManagement —
    // also patch root buildscript repositories block as fallback.
    if (!config.modResults.contents.includes("jitpack.io")) {
      config.modResults.contents = contents.replace(
        /repositories\s*\{/,
        (match) => `${match}\n        maven { url 'https://jitpack.io' }`,
      );
    }
    return config;
  });
}

function withCameraKit(config) {
  config = withCameraKitIos(config);
  config = withCameraKitAndroidManifest(config);
  config = withJitpack(config);
  return config;
}

module.exports = createRunOncePlugin(withCameraKit, "withCameraKit", "1.0.0");
