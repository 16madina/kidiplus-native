import { lazy, Suspense, useEffect, useRef } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomTabBar } from "./components/BottomTabBar";
import { PushScreen } from "./components/PushScreen";
import { useAuth } from "./context/auth";
import { useNav, type OverlayKind } from "./context/navigation";
import { useAppTheme } from "./context/theme";
import { AuthFlow } from "./screens/AuthFlow";
import { HomeScreen } from "./screens/HomeScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { LiveTabScreen } from "./screens/LiveTabScreen";
import { VitrineScreen } from "./screens/VitrineScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { LiveViewerScreen } from "./screens/LiveViewerScreen";
import { LiveListViewer } from "./components/LiveListViewer";
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
import { EditProfileScreen } from "./screens/EditProfileScreen";
import { CertificationScreen } from "./screens/CertificationScreen";
import { DeliverySettingsScreen } from "./screens/DeliverySettingsScreen";
import { BroadcastSetupScreen } from "./screens/BroadcastSetupScreen";
import { DeleteAccountScreen } from "./screens/DeleteAccountScreen";
import { AdminDashboardScreen } from "./screens/AdminDashboardScreen";
import { BlockedUsersScreen } from "./screens/BlockedUsersScreen";
import { DmChatScreen } from "./screens/DmChatScreen";
import { SellerPaymentsScreen } from "./screens/SellerPaymentsScreen";
import { SellerProfileScreen } from "./screens/SellerProfileScreen";
import { DiscoverScreen } from "./screens/DiscoverScreen";
import { ExpoGoBanner } from "./components/ExpoGoBanner";
import { HostResumeListener } from "./components/home/HostResumeListener";
import { LivePipShell } from "./components/live/LivePipShell";
import { isExpoGo } from "./lib/expo-go";
import { useViewerSystemPip } from "./lib/live-pip";
import { LiveSystemPipProvider } from "./lib/live-system-pip";
import { GOLD, NAVY } from "./theme";
import { CONTENT_MAX_WIDTH } from "./lib/layout";

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
        Les lives vidéo demandent l’app KiDi+ (pas Expo Go). Sur ton Mac : npm run rebuild:ios
        puis ouvre l’icône KiDi+ — pas Expo Go.
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

/** Keep last-known payload so exit animation still has content while unmounting. */
function useCachedOverlay<K extends OverlayKind>(kind: K) {
  const { findOverlay, isOverlayOpen } = useNav();
  const open = isOverlayOpen(kind);
  const current = findOverlay(kind);
  const last = useRef(current);
  if (current) last.current = current;
  return { open, entry: last.current };
}

export function AppShell() {
  const {
    tab,
    setTab,
    overlay,
    closeOverlay,
    isOverlayOpen,
    livePresentation,
    minimizeLive,
    expandLive,
    closeLive,
  } = useNav();
  const { authOverlay, closeAuth } = useAuth();
  const { dark, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const tabletColumn = width >= 768 ? { maxWidth: CONTENT_MAX_WIDTH, width: "100%" as const, alignSelf: "center" as const } : null;

  const activity = useCachedOverlay("activity");
  const dmChat = useCachedOverlay("dm-chat");
  const legal = useCachedOverlay("legal");
  const shop = useCachedOverlay("shop");
  const orders = useCachedOverlay("orders");
  const broadcastSetup = useCachedOverlay("broadcast-setup");
  const broadcastLive = useCachedOverlay("broadcast-live");
  const live = useCachedOverlay("live");
  const sellerProfile = useCachedOverlay("seller-profile");

  const liveFullScreen = isOverlayOpen("live") && livePresentation === "full";
  const liveMinimized = isOverlayOpen("live") && livePresentation === "minimized";
  const watchingStream = live.entry?.list[live.entry.index] ?? live.entry?.stream;
  const liveHasVideo =
    Boolean(live.open && watchingStream?.roomName && !watchingStream.fictitious) &&
    !isExpoGo();
  const pip = useViewerSystemPip(liveHasVideo, closeLive);
  const systemPip = pip.systemPip;
  const hideTabs =
    tab === "vitrine" || liveFullScreen || isOverlayOpen("broadcast-live");
  const statusLight = tab === "vitrine" || liveFullScreen || isOverlayOpen("broadcast-live") || dark;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (overlay.kind === "live" && livePresentation === "full") {
        minimizeLive();
        return true;
      }
      if (overlay.kind === "live" && livePresentation === "minimized") {
        closeLive();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [overlay.kind, livePresentation, minimizeLive, closeLive]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <HostResumeListener />
      <StatusBar style={statusLight ? "light" : "dark"} />
      <View style={[styles.pane, tab === "home" ? styles.shown : styles.hidden]}>
        <View style={[{ flex: 1 }, tabletColumn]}>
          <HomeScreen />
        </View>
      </View>
      <View style={[styles.pane, tab === "search" ? styles.shown : styles.hidden]}>
        <View style={[{ flex: 1 }, tabletColumn]}>
          <SearchScreen />
        </View>
      </View>
      <View style={[styles.pane, tab === "live" ? styles.shown : styles.hidden]}>
        <View style={[{ flex: 1 }, tabletColumn]}>
          <LiveTabScreen />
        </View>
      </View>
      <View style={[styles.pane, tab === "vitrine" ? styles.shown : styles.hidden]}>
        <VitrineScreen />
      </View>
      <View style={[styles.pane, tab === "profile" ? styles.shown : styles.hidden]}>
        <View style={[{ flex: 1 }, tabletColumn]}>
          <ProfileScreen />
        </View>
      </View>
      <BottomTabBar active={tab} onChange={setTab} hidden={hideTabs} />

      <PushScreen open={activity.open} onClose={closeOverlay} zIndex={70}>
        <ActivityScreen />
      </PushScreen>
      <PushScreen open={dmChat.open} onClose={closeOverlay} zIndex={82}>
        {dmChat.entry ? (
          <DmChatScreen target={dmChat.entry.target} onClose={closeOverlay} />
        ) : null}
      </PushScreen>
      <PushScreen open={legal.open} onClose={closeOverlay} zIndex={72}>
        {legal.entry ? <LegalScreen page={legal.entry.page} onClose={closeOverlay} /> : null}
      </PushScreen>
      <PushScreen open={isOverlayOpen("wallet")} onClose={closeOverlay} zIndex={70}>
        <WalletScreen />
      </PushScreen>
      <PushScreen open={shop.open} onClose={closeOverlay} zIndex={70}>
        {shop.entry ? (
          <ShopScreen sellerId={shop.entry.sellerId} sellerName={shop.entry.sellerName} />
        ) : null}
      </PushScreen>
      <PushScreen open={orders.open} onClose={closeOverlay} zIndex={70}>
        <OrdersScreen orderId={orders.entry?.orderId} />
      </PushScreen>
      <PushScreen open={isOverlayOpen("earnings")} onClose={closeOverlay} zIndex={72}>
        <EarningsScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("settings")} onClose={closeOverlay} zIndex={70}>
        <SettingsScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("help")} onClose={closeOverlay} zIndex={70}>
        <HelpScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("referral")} onClose={closeOverlay} zIndex={70}>
        <ReferralScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("addresses")} onClose={closeOverlay} zIndex={70}>
        <AddressesScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("edit-profile")} onClose={closeOverlay} zIndex={70}>
        <EditProfileScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("certification")} onClose={closeOverlay} zIndex={70}>
        <CertificationScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("delivery")} onClose={closeOverlay} zIndex={70}>
        <DeliverySettingsScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("delete-account")} onClose={closeOverlay} zIndex={72}>
        <DeleteAccountScreen />
      </PushScreen>
      <PushScreen open={broadcastSetup.open} onClose={closeOverlay} zIndex={70}>
        {broadcastSetup.entry ? <BroadcastSetupScreen mode={broadcastSetup.entry.mode} /> : null}
      </PushScreen>
      <PushScreen
        open={broadcastLive.open}
        onClose={closeOverlay}
        zIndex={85}
        swipeBackEnabled={false}
      >
        {broadcastLive.entry ? (
          <Suspense fallback={<BroadcastLiveFallback />}>
            <BroadcastLiveScreen
              liveId={broadcastLive.entry.liveId}
              roomName={broadcastLive.entry.roomName}
              title={broadcastLive.entry.title}
              identity={broadcastLive.entry.identity}
              displayName={broadcastLive.entry.displayName}
              facing={broadcastLive.entry.facing}
              rtmpMode={broadcastLive.entry.rtmpMode}
              rtmpCreds={broadcastLive.entry.rtmpCreds}
            />
          </Suspense>
        ) : null}
      </PushScreen>
      <PushScreen open={isOverlayOpen("blocked-users")} onClose={closeOverlay} zIndex={72}>
        <BlockedUsersScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("admin")} onClose={closeOverlay} zIndex={70}>
        <AdminDashboardScreen />
      </PushScreen>
      <PushScreen open={isOverlayOpen("seller-payments")} onClose={closeOverlay} zIndex={80}>
        <SellerPaymentsScreen />
      </PushScreen>
      <PushScreen open={sellerProfile.open} onClose={closeOverlay} zIndex={72}>
        {sellerProfile.entry ? (
          <SellerProfileScreen sellerId={sellerProfile.entry.sellerId} />
        ) : null}
      </PushScreen>
      <PushScreen open={isOverlayOpen("discover")} onClose={closeOverlay} zIndex={70}>
        <DiscoverScreen />
      </PushScreen>
      {live.open && live.entry ? (
        <LiveSystemPipProvider value={systemPip}>
          <LivePipShell
            minimized={liveMinimized}
            systemPip={systemPip}
            onExpand={expandLive}
            onClose={closeLive}
            onMinimize={minimizeLive}
          >
            <LiveListViewer
              list={live.entry.list}
              initialIndex={live.entry.index}
              compact={liveMinimized}
            />
          </LivePipShell>
        </LiveSystemPipProvider>
      ) : null}
      <PushScreen open={authOverlay} onClose={closeAuth} zIndex={90}>
        <AuthFlow overlay />
      </PushScreen>
      <ExpoGoBanner />
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
