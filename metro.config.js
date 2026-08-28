const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const cameraKitRoot = path.resolve(projectRoot, "modules/kidi-camera-kit");
const liveEffectsRoot = path.resolve(projectRoot, "modules/kidi-live-effects");

config.watchFolders = [...(config.watchFolders ?? []), path.resolve(projectRoot, "modules")];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "kidi-camera-kit": cameraKitRoot,
  "kidi-live-effects": liveEffectsRoot,
};

module.exports = config;
