const {
  withPodfile,
  withXcodeProject,
  createRunOncePlugin,
} = require("expo/config-plugins");

const INHIBIT_MARKER = "# kidiplus-silence-pod-warnings";
const POST_MARKER = "# kidiplus-silence-pod-warnings-post";

/**
 * Xcode lists hundreds of warnings from Expo, React Native, Stripe, LiveKit,
 * and Google Sign-In — not from KiDi+ code. Those files live in node_modules
 * / Pods and are overwritten on every install, so we silence vendor targets
 * instead of patching their sources.
 *
 * App-target flags only hide noise that leaks in through vendor headers
 * (incomplete React umbrella, missing nullability, forward-declared protocols).
 */
const APP_WARNING_CFLAGS =
  "$(inherited) -Wno-incomplete-umbrella -Wno-nullability-completeness -Wno-protocol";

function applyInhibitAllWarnings(contents) {
  if (contents.includes("inhibit_all_warnings!")) {
    return contents;
  }
  const snippet = `${INHIBIT_MARKER}\ninhibit_all_warnings!\n`;
  if (/prepare_react_native_project!\n/.test(contents)) {
    return contents.replace(
      /prepare_react_native_project!\n/,
      `prepare_react_native_project!\n${snippet}`,
    );
  }
  if (/platform :ios[^\n]*\n/.test(contents)) {
    return contents.replace(/platform :ios[^\n]*\n/, (line) => `${line}${snippet}`);
  }
  return `${snippet}${contents}`;
}

function applyPostInstallSilence(contents) {
  if (contents.includes(POST_MARKER)) {
    return contents;
  }
  if (!/post_install do \|installer\|/.test(contents)) {
    throw new Error("Podfile has no post_install hook to silence pod warnings.");
  }
  return contents.replace(
    /post_install do \|installer\|/,
    `post_install do |installer|
    ${POST_MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        bc.build_settings['SWIFT_SUPPRESS_WARNINGS'] = 'YES'
        bc.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
      end
    end`,
  );
}

function applyPodfileSilencing(contents) {
  return applyPostInstallSilence(applyInhibitAllWarnings(contents));
}

function applyAppTargetWarningFlags(project) {
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const id of Object.keys(configurations)) {
    const item = configurations[id];
    if (!item || typeof item !== "object" || !item.buildSettings) {
      continue;
    }
    item.buildSettings.WARNING_CFLAGS = APP_WARNING_CFLAGS;
    item.buildSettings.CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = "NO";
  }
  return project;
}

function withSilenceIosPodWarnings(config) {
  config = withPodfile(config, (config) => {
    config.modResults.contents = applyPodfileSilencing(config.modResults.contents);
    return config;
  });
  config = withXcodeProject(config, (config) => {
    applyAppTargetWarningFlags(config.modResults);
    return config;
  });
  return config;
}

const plugin = createRunOncePlugin(
  withSilenceIosPodWarnings,
  "withSilenceIosPodWarnings",
  "1.0.0",
);
plugin.applyPodfileSilencing = applyPodfileSilencing;
plugin.applyAppTargetWarningFlags = applyAppTargetWarningFlags;
module.exports = plugin;
