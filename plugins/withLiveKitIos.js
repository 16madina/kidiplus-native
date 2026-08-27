const { withPodfile, createRunOncePlugin } = require("expo/config-plugins");

const MARKER = "# kidiplus-livekit-ios-fix";

/**
 * LiveKit WebRTC + Expo SDK 57 (precompiled React as frameworks) needs
 * non-modular React headers allowed on the LiveKit pods.
 */
function withLiveKitIos(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    if (!/post_install do \|installer\|/.test(contents)) {
      throw new Error("Podfile has no post_install hook to patch for LiveKit.");
    }

    config.modResults.contents = contents.replace(
      /post_install do \|installer\|/,
      `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |target|
      next unless ['livekit-react-native', 'livekit-react-native-webrtc', 'LiveKitExpoPlugin'].include?(target.name)
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        bc.build_settings['DEFINES_MODULE'] = 'YES'
      end
    end`,
    );
    return config;
  });
}

module.exports = createRunOncePlugin(withLiveKitIos, "withLiveKitIos", "1.0.0");
