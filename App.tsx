import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import "./src/i18n";
import { LanguageProvider } from "./src/context/language";
import { ThemeProvider } from "./src/context/theme";
import { AuthProvider, useAuth } from "./src/context/auth";
import { NavigationProvider } from "./src/context/navigation";
import { PushProvider } from "./src/context/push";
import { FilterProvider } from "./src/lib/filters/filter-context";
import { SplashScreen } from "./src/screens/SplashScreen";
import { AuthFlow } from "./src/screens/AuthFlow";
import { AppShell } from "./src/AppShell";
import { NAVY } from "./src/theme";

function Root() {
  const [splashDone, setSplashDone] = useState(false);
  const { user, guestMode, loading } = useAuth();

  if (!splashDone) {
    return (
      <View style={styles.fill}>
        <StatusBar style="light" />
        <SplashScreen onDone={() => setSplashDone(true)} />
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
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <NavigationProvider>
                <FilterProvider>
                  <Root />
                </FilterProvider>
              </NavigationProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: NAVY },
});
