const {
  withProjectBuildGradle,
  createRunOncePlugin,
} = require("expo/config-plugins");

const MARKER = "KIDI_LIVEKIT_AUDIOSWITCH";
const AUDIO_SWITCH_VERSION = "039a35aefab7747c557242fa216c9ea11743b604";

function withLiveKitAudioSwitch(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;

    const contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    config.modResults.contents = `${contents.trimEnd()}

// ${MARKER}: LiveKit Android 2.28.0 requires CommDeviceAudioSwitch.
// @livekit/react-native otherwise pins an older revision without that class.
allprojects {
  configurations.configureEach {
    resolutionStrategy.force 'com.github.davidliu:audioswitch:${AUDIO_SWITCH_VERSION}'
  }
}
`;
    return config;
  });
}

module.exports = createRunOncePlugin(
  withLiveKitAudioSwitch,
  "withLiveKitAudioSwitch",
  "1.0.0",
);
