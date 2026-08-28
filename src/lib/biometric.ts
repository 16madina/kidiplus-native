import { requireOptionalNativeModule } from "expo-modules-core";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BIOMETRIC_ENABLED_KEY = "kidiplus.biometricEnabled";

let _nativeMod: any = undefined;

function getNativeLocalAuth(): any {
  if (_nativeMod === undefined) {
    try {
      _nativeMod = requireOptionalNativeModule("ExpoLocalAuthentication") ?? null;
    } catch {
      _nativeMod = null;
    }
  }
  return _nativeMod;
}

export async function canUseBiometric(): Promise<boolean> {
  const mod = getNativeLocalAuth();
  if (!mod) return false;
  try {
    const compatible = await mod.hasHardwareAsync();
    if (!compatible) return false;
    return await mod.isEnrolledAsync();
  } catch {
    return false;
  }
}

export async function authenticateWithBiometric(): Promise<boolean> {
  const mod = getNativeLocalAuth();
  if (!mod) return false;
  try {
    const result = await mod.authenticateAsync({
      promptMessage: "Déverrouiller KiDi+",
      fallbackLabel: "Utiliser le code",
      cancelLabel: "Annuler",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return val === "true";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
}
