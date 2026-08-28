import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { requireOptionalNativeModule } from "expo-modules-core";
import "./src/i18n";
import { LanguageProvider } from "./src/context/language";
import { ThemeProvider } from "./src/context/theme";
import { AuthProvider, useAuth } from "./src/context/auth";
import { NavigationProvider } from "./src/context/navigation";
import { PushProvider } from "./src/context/push";
import { FilterProvider } from "./src/lib/filters/filter-context";
import { LiveEffectsProvider } from "./src/lib/filters/live-effects-context";
import { ForceUpdateGate } from "./src/components/ForceUpdateGate";
import { ModerationGate } from "./src/components/ModerationGate";
import { SplashScreen } from "./src/screens/SplashScreen";
import { AuthFlow } from "./src/screens/AuthFlow";
import { AppShell } from "./src/AppShell";
import { authenticateWithBiometric, isBiometricEnabled } from "./src/lib/biometric";
import { NAVY } from "./src/theme";

function useTrackingTransparency() {
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    (async () => {
      try {
        const mod: any = requireOptionalNativeModule("ExpoTrackingTransparency");
        if (!mod) return;
        await mod.requestPermissionsAsync();
      } catch {}
    })();
  }, []);
}

function Root() {
  const [splashDone, setSplashDone] = useState(false);
  const [biometricPassed, setBiometricPassed] = useState(false);
  const { user, guestMode, loading } = useAuth();

  useTrackingTransparency();

  useEffect(() => {
    if (!splashDone) return;
    (async () => {
      const enabled = await isBiometricEnabled();
      if (!enabled) { setBiometricPassed(true); return; }
      const ok = await authenticateWithBiometric();
      setBiometricPassed(ok);
    })();
  }, [splashDone]);

  if (!splashDone) {
    return (
      <View style={styles.fill}>
        <StatusBar style="light" />
        <SplashScreen onDone={() => setSplashDone(true)} />
      </View>
    );
  }

  if (!biometricPassed) {
    return (
      <View style={styles.fill}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.fill}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!user && !guestMode) {
    return (
      <View style={styles.fill}>
        <StatusBar style="light" />
        <AuthFlow />
      </View>
    );
  }

  return (
    <PushProvider>
      <AppShell />
    </PushProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <ForceUpdateGate>
          <LanguageProvider>
            <ThemeProvider>
              <AuthProvider>
                <NavigationProvider>
                  <FilterProvider>
                    <LiveEffectsProvider>
                      <ModerationGate>
                        <Root />
                      </ModerationGate>
                    </LiveEffectsProvider>
                  </FilterProvider>
                </NavigationProvider>
              </AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        </ForceUpdateGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: NAVY },
});
