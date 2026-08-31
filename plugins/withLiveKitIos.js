const { withPodfile, createRunOncePlugin } = require("expo/config-plugins");

const MARKER = "# kidiplus-livekit-ios-fix";
const SOURCE_MARKER = "# kidiplus-livekit-client-source";

/**
 * LiveKit WebRTC + Expo SDK 57 (precompiled React as frameworks) needs
 * non-modular React headers allowed on the LiveKit pods.
 * Camera Kit iOS publish also needs LiveKitClient from livekit/podspecs.
 * The Swift module name of that pod is LiveKitClient (not LiveKit).
 */
function withLiveKitIos(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes("github.com/livekit/podspecs.git")) {
      const sources = `${SOURCE_MARKER}\nsource "https://cdn.cocoapods.org/"\nsource "https://github.com/livekit/podspecs.git"\n`;
      if (/platform :ios[^\n]*\n/.test(contents)) {
        contents = contents.replace(/platform :ios[^\n]*\n/, (m) => `${m}${sources}`);
      } else {
        contents = `${sources}${contents}`;
      }
    }

    if (!contents.includes(MARKER)) {
      if (!/post_install do \|installer\|/.test(contents)) {
        throw new Error("Podfile has no post_install hook to patch for LiveKit.");
      }
      contents = contents.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |target|
      next unless ['livekit-react-native', 'livekit-react-native-webrtc', 'LiveKitExpoPlugin', 'KidiCameraKit', 'KidiLivePip', 'LiveKitClient'].include?(target.name)
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        bc.build_settings['DEFINES_MODULE'] = 'YES'
      end
    end`,
      );
    } else if (!contents.includes("'KidiLivePip'")) {
      contents = contents.replace(
        "'KidiCameraKit', 'LiveKitClient'",
        "'KidiCameraKit', 'KidiLivePip', 'LiveKitClient'",
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(withLiveKitIos, "withLiveKitIos", "1.3.0");
