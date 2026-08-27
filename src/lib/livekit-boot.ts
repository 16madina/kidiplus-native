import { registerGlobals } from "@livekit/react-native";

let ready = false;

/** Call only from lazy LiveKit screens — never from App/AppShell. */
export function bootLiveKit(): void {
  if (ready) return;
  registerGlobals();
  ready = true;
}
