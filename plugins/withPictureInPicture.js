const {
  withAndroidManifest,
  withMainActivity,
  createRunOncePlugin,
} = require("expo/config-plugins");

function withPipManifest(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    const activities = app?.activity || [];
    for (const activity of activities) {
      const name = activity.$?.["android:name"] || "";
      if (!name.includes("MainActivity")) continue;
      activity.$["android:supportsPictureInPicture"] = "true";
      activity.$["android:resizeableActivity"] = "true";
      const existing = activity.$["android:configChanges"] || "";
      const parts = new Set(existing.split("|").map((s) => s.trim()).filter(Boolean));
      for (const key of ["screenSize", "smallestScreenSize", "screenLayout", "orientation"]) {
        parts.add(key);
      }
      activity.$["android:configChanges"] = [...parts].join("|");
    }
    return config;
  });
}

function insertBeforeLastBrace(src, snippet) {
  const idx = src.lastIndexOf("}");
  if (idx < 0) return src;
  return `${src.slice(0, idx)}\n${snippet}\n${src.slice(idx)}`;
}

function withPipMainActivity(config) {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;
    if (src.includes("KidiLivePipState.onUserLeaveHint")) return config;
    const isKotlin = (config.modResults.language || "kt") === "kt";
    const snippet = isKotlin
      ? `
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    com.kidiplus.livepip.KidiLivePipState.onUserLeaveHint(this)
  }

  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: android.content.res.Configuration
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    com.kidiplus.livepip.KidiLivePipState.notifyMode(isInPictureInPictureMode)
  }
`
      : `
  @Override
  public void onUserLeaveHint() {
    super.onUserLeaveHint();
    com.kidiplus.livepip.KidiLivePipState.onUserLeaveHint(this);
  }

  @Override
  public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, android.content.res.Configuration newConfig) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
    com.kidiplus.livepip.KidiLivePipState.notifyMode(isInPictureInPictureMode);
  }
`;
    config.modResults.contents = insertBeforeLastBrace(src, snippet);
    return config;
  });
}

function withPictureInPicture(config) {
  config = withPipManifest(config);
  config = withPipMainActivity(config);
  return config;
}

module.exports = createRunOncePlugin(withPictureInPicture, "withPictureInPicture", "1.0.0");
