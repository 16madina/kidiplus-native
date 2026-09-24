const { withAndroidManifest, createRunOncePlugin } = require("expo/config-plugins");

const MEDIA_PROJECTION_PERMISSION = "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION";
const SCREEN_CAPTURE_SERVICE = "io.livekit.android.room.track.screencapture.ScreenCaptureService";

/**
 * KiDi Plus streams the device camera; it does not offer device-screen sharing.
 * LiveKit exposes screen capture as an optional feature and contributes both of
 * these declarations through manifest merging. Remove them so Google Play does
 * not require a foreground media-projection declaration for an unused feature.
 */
function withRemoveLiveKitScreenShare(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    manifest["uses-permission"] = manifest["uses-permission"] || [];
    if (!manifest["uses-permission"].some((entry) => entry.$?.["android:name"] === MEDIA_PROJECTION_PERMISSION)) {
      manifest["uses-permission"].push({
        $: { "android:name": MEDIA_PROJECTION_PERMISSION, "tools:node": "remove" },
      });
    }

    const application = manifest.application?.[0];
    if (application) {
      application.service = application.service || [];
      if (!application.service.some((entry) => entry.$?.["android:name"] === SCREEN_CAPTURE_SERVICE)) {
        application.service.push({
          $: { "android:name": SCREEN_CAPTURE_SERVICE, "tools:node": "remove" },
        });
      }
    }
    return config;
  });
}

module.exports = createRunOncePlugin(
  withRemoveLiveKitScreenShare,
  "withRemoveLiveKitScreenShare",
  "1.0.0",
);
