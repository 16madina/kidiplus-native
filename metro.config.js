const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const cameraKitRoot = path.resolve(projectRoot, "modules/kidi-camera-kit");
const liveEffectsRoot = path.resolve(projectRoot, "modules/kidi-live-effects");

config.watchFolders = [...(config.watchFolders ?? []), path.resolve(projectRoot, "modules")];

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
