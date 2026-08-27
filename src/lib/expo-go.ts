import Constants, { ExecutionEnvironment } from "expo-constants";

/** Expo Go has no LiveKit / WebRTC native modules. */
export function isExpoGo(): boolean {
  return (
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}
