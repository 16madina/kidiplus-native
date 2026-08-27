import { lazy, Suspense, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomTabBar } from "./components/BottomTabBar";
import { PushScreen } from "./components/PushScreen";
import { useAuth } from "./context/auth";
import { useNav, type Overlay } from "./context/navigation";
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
import { WalletScreen } from "./screens/WalletScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { EarningsScreen } from "./screens/EarningsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { AddressesScreen } from "./screens/AddressesScreen";
import { HelpScreen } from "./screens/HelpScreen";
import { ReferralScreen } from "./screens/ReferralScreen";
import { BroadcastSetupScreen } from "./screens/BroadcastSetupScreen";
import { AdminDashboardScreen } from "./screens/AdminDashboardScreen";
import { GOLD, NAVY } from "./theme";

const BroadcastLiveScreen = lazy(async () => {
  try {
    const mod = await import("./screens/BroadcastLiveScreen");
    return { default: mod.BroadcastLiveScreen };
  } catch {
    return { default: LiveKitBuildRequired };
  }
});

function LiveKitBuildRequired() {
  return (
    <View style={styles.livekitFallback}>
      <Text style={styles.livekitFallbackTxt}>
        Les lives vidéo demandent un build natif (pas Expo Go). Sur ton Mac : npm install && npx expo
        run:ios --device
      </Text>
    </View>
  );
}

function BroadcastLiveFallback() {
  return (
    <View style={styles.livekitFallback}>
      <ActivityIndicator color={GOLD} />
    </View>
  );
}

export function AppShell() {
  const { tab, setTab, overlay, closeOverlay } = useNav();
  const { authOverlay, closeAuth } = useAuth();
  const { dark, colors } = useAppTheme();
  const hideTabs =
    tab === "vitrine" || overlay.kind === "live" || overlay.kind === "broadcast-live";
  const last = useRef<Overlay>(overlay);
  if (overlay.kind !== "none") last.current = overlay;
  const shown = last.current;
  const statusLight =
    tab === "vitrine" || overlay.kind === "live" || overlay.kind === "broadcast-live" || dark;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={statusLight ? "light" : "dark"} />
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

      <PushScreen open={overlay.kind === "activity"} onClose={closeOverlay}>
        <ActivityScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "legal"} onClose={closeOverlay}>
        {shown.kind === "legal" ? <LegalScreen page={shown.page} onClose={closeOverlay} /> : null}
      </PushScreen>
      <PushScreen open={overlay.kind === "wallet"} onClose={closeOverlay}>
        <WalletScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "shop"} onClose={closeOverlay}>
        {shown.kind === "shop" ? (
          <ShopScreen sellerId={shown.sellerId} sellerName={shown.sellerName} />
        ) : null}
      </PushScreen>
      <PushScreen open={overlay.kind === "orders"} onClose={closeOverlay}>
        <OrdersScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "earnings"} onClose={closeOverlay}>
        <EarningsScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "settings"} onClose={closeOverlay}>
        <SettingsScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "help"} onClose={closeOverlay}>
        <HelpScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "referral"} onClose={closeOverlay}>
        <ReferralScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "addresses"} onClose={closeOverlay}>
        <AddressesScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "broadcast-setup"} onClose={closeOverlay}>
        {shown.kind === "broadcast-setup" ? <BroadcastSetupScreen mode={shown.mode} /> : null}
      </PushScreen>
      <PushScreen
        open={overlay.kind === "broadcast-live"}
        onClose={closeOverlay}
        zIndex={85}
        swipeBackEnabled={false}
      >
        {shown.kind === "broadcast-live" ? (
          <Suspense fallback={<BroadcastLiveFallback />}>
            <BroadcastLiveScreen
              liveId={shown.liveId}
              roomName={shown.roomName}
              title={shown.title}
              identity={shown.identity}
              displayName={shown.displayName}
              facing={shown.facing}
            />
          </Suspense>
        ) : null}
      </PushScreen>
      <PushScreen open={overlay.kind === "admin"} onClose={closeOverlay}>
        <AdminDashboardScreen />
      </PushScreen>
      <PushScreen open={overlay.kind === "live"} onClose={closeOverlay} zIndex={80}>
        {shown.kind === "live" ? <LiveViewerScreen stream={shown.stream} /> : null}
      </PushScreen>
      <PushScreen open={authOverlay} onClose={closeAuth} zIndex={90}>
        <AuthFlow overlay />
      </PushScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  pane: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  shown: { zIndex: 2, opacity: 1 },
  hidden: { zIndex: 0, opacity: 0, pointerEvents: "none" },
  livekitFallback: {
    flex: 1,
    backgroundColor: "#05060a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  livekitFallbackTxt: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 22,
  },
});
