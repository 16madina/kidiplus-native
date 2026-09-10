const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const cameraKitRoot = path.resolve(projectRoot, "modules/kidi-camera-kit");
const liveEffectsRoot = path.resolve(projectRoot, "modules/kidi-live-effects");

// `modules` already lives inside projectRoot and is watched automatically.
// Adding it again creates a redundant watcher tree. Native sources are built
// by Xcode/Gradle and must not be watched by Metro (ios/Pods alone contains
// thousands of directories and can exhaust macOS' watcher limit).
config.watchFolders = (config.watchFolders ?? []).filter(
  (folder) => path.resolve(folder) !== path.resolve(projectRoot, "modules"),
);
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /^ios[\\/]/,
  /^android[\\/]/,
  /^\.git[\\/]/,
];

const imageManipulatorStub = path.resolve(projectRoot, "src/shims/expo-image-manipulator.ts");
const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "kidi-camera-kit": cameraKitRoot,
  "kidi-live-effects": liveEffectsRoot,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "expo-image-manipulator" || moduleName.startsWith("expo-image-manipulator/")) {
    return { type: "sourceFile", filePath: imageManipulatorStub };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
