import { LogBox } from "react-native";
import { registerGlobals } from "@livekit/react-native";

let ready = false;

/**
 * Must run as soon as this module loads, before livekit-client opens a
 * WebSocket. Only imported from lazy LiveKit screens (not App/AppShell).
 */
try {
  registerGlobals();
  ready = true;
} catch {
  // Expo Go has no WebRTC native module.
}

try {
  LogBox.ignoreLogs(["error reading from signal stream"]);
} catch {
  /* web / tests */
}

export function bootLiveKit(): void {
  if (ready) return;
  registerGlobals();
  ready = true;
}
