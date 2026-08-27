import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomTabBar } from "./components/BottomTabBar";
import { useAuth } from "./context/auth";
import { useNav } from "./context/navigation";
import { useAppTheme } from "./context/theme";
import { AuthFlow } from "./screens/AuthFlow";
import { HomeScreen } from "./screens/HomeScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { LiveTabScreen } from "./screens/LiveTabScreen";
import { VitrineScreen } from "./screens/VitrineScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { LiveViewerScreen } from "./screens/LiveViewerScreen";
import { ActivityScreen } from "./screens/ActivityScreen";
import { LegalScreen } from "./screens/LegalScreen";
import { PlaceholderScreen } from "./screens/PlaceholderScreen";
import { NAVY } from "./theme";

export function AppShell() {
  const { tab, setTab, overlay, closeOverlay } = useNav();
  const { authOverlay } = useAuth();
  const { dark, colors } = useAppTheme();
  const hideTabs = tab === "vitrine" || overlay.kind === "live";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={tab === "vitrine" || overlay.kind === "live" || dark ? "light" : "dark"} />
      <View style={[styles.pane, tab === "home" ? styles.shown : styles.hidden]}>
        <HomeScreen />
      </View>
      <View style={[styles.pane, tab === "search" ? styles.shown : styles.hidden]}>
        <SearchScreen />
      </View>
      <View style={[styles.pane, tab === "live" ? styles.shown : styles.hidden]}>
        <LiveTabScreen />
      </View>
      <View style={[styles.pane, tab === "vitrine" ? styles.shown : styles.hidden]}>
        <VitrineScreen />
      </View>
      <View style={[styles.pane, tab === "profile" ? styles.shown : styles.hidden]}>
        <ProfileScreen />
      </View>
      <BottomTabBar active={tab} onChange={setTab} hidden={hideTabs} />
      {overlay.kind === "live" ? <LiveViewerScreen /> : null}
      {overlay.kind === "activity" ? <ActivityScreen /> : null}
      {overlay.kind === "legal" ? <LegalScreen page={overlay.page} onClose={closeOverlay} /> : null}
      {overlay.kind === "shop" ||
      overlay.kind === "wallet" ||
      overlay.kind === "orders" ||
      overlay.kind === "earnings" ||
      overlay.kind === "settings" ||
      overlay.kind === "help" ||
      overlay.kind === "addresses" ||
      overlay.kind === "broadcast-setup" ? (
        <View style={styles.overlay}>
          <PlaceholderScreen kind={overlay.kind} />
        </View>
      ) : null}
      {authOverlay ? <AuthFlow overlay /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  pane: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  shown: { zIndex: 2, opacity: 1 },
  hidden: { zIndex: 0, opacity: 0, pointerEvents: "none" },
  overlay: { ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, zIndex: 70, backgroundColor: "#fff" },
});
