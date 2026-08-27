const { withInfoPlist, createRunOncePlugin } = require("expo/config-plugins");

/**
 * RCTStatusBarManager.setStyle crashes unless this key is NO.
 * iOS defaults to YES when the key is missing, so we force it last.
 */
function withStatusBarPlist(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIViewControllerBasedStatusBarAppearance = false;
    return config;
  });
}

module.exports = createRunOncePlugin(withStatusBarPlist, "withStatusBarPlist", "1.0.0");
