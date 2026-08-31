import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Coins,
  CreditCard,
  HelpCircle,
  HeartHandshake,
  Lightbulb,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  Package,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  UserPen,
  UserPlus,
  Wallet,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Logo } from "../components/Logo";
import { Press } from "../components/Press";
import { Glass, GlassIconButton } from "../components/Glass";
import { SurfaceCard } from "../components/SurfaceCard";
import { ReferredBadge } from "../components/ReferredBadge";
import { FrozenBanner } from "../components/FrozenBanner";
import { TAB_SAFE_PADDING } from "../components/BottomTabBar";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { GOLD, GUEST_CREAM, NAVY, NAVY_600, NAVY_INSET, initials } from "../theme";
import { formatMoney } from "../lib/money";
import { PROFILE_MENU_TINT } from "../lib/profile-menu-tints";
import { fetchMyPromoCodes } from "../lib/referrals";
import { isHttpUrl } from "../lib/storage";

const guestBg = require("../../assets/guest/guest-profile-bg-v2.jpg");
const guestIllu = require("../../assets/guest/guest-profile-illustration.png");

export function ProfileScreen() {
  const { guestMode, user } = useAuth();
  if (guestMode || !user) return <GuestProfile />;
  return <AuthedProfile />;
}

function GuestProfile() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { openAuth } = useAuth();
  const { openOverlay } = useNav();
  return (
    <View style={styles.guestRoot}>
      <Image source={guestBg} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(251,246,236,0.82)" }]} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: TAB_SAFE_PADDING + insets.bottom + 16, alignItems: "center", paddingHorizontal: 24 }}>
        <View style={styles.guestHead}>
          <GlassIconButton tone="light" onPress={() => openAuth()}>
            <Bell size={20} color={NAVY} />
          </GlassIconButton>
          <Text style={styles.guestHeadTitle}>{t("tabs.profile")}</Text>
          <GlassIconButton tone="light" onPress={() => openAuth()}>
            <MessageCircle size={20} color={NAVY} />
          </GlassIconButton>
        </View>
        <Logo size={72} />
        <Text style={styles.guestTitle}>
          {t("guestProfile.title1", { defaultValue: "Crée un compte pour" })}
          {"\n"}
          <Text style={{ color: GOLD }}>{t("guestProfile.title2", { defaultValue: "débloquer ton profil" })}</Text>
        </Text>
        <Text style={styles.guestSub}>
          {t("guestProfile.subtitle", { defaultValue: "Ton portefeuille, tes commandes, tes adresses et tes réglages — tout est à un tap." })}
        </Text>
        <Press onPress={() => openAuth("signup")} style={[styles.goldBtn, { marginTop: 16 }]}>
          <UserPlus size={17} color="#fff" />
          <Text style={styles.goldBtnText}>{t("auth.welcome.signUp")}</Text>
        </Press>
        <Press onPress={() => openAuth("signin")} style={{ width: "100%", marginTop: 8, minHeight: 44, alignItems: "stretch" }}>
          <Glass tone="light" intensity={40} radius={999}>
            <View style={styles.whiteBtn}>
              <LogIn size={17} color={NAVY} />
              <Text style={{ fontWeight: "800", color: NAVY }}>{t("auth.welcome.signIn")}</Text>
            </View>
          </Glass>
        </Press>
        <Image source={guestIllu} style={{ width: 90, height: 90, marginTop: 4 }} contentFit="contain" />
        <View style={styles.featGrid}>
          <Feat icon={<Wallet size={17} color={NAVY} />} label={t("profile.quick.wallet")} onPress={() => openAuth()} />
          <Feat icon={<Package size={17} color={NAVY} />} label={t("profile.quick.orders")} onPress={() => openAuth()} />
          <Feat icon={<TrendingUp size={17} color={NAVY} />} label={t("profile.quick.earnings")} onPress={() => openAuth()} />
          <Feat icon={<Store size={17} color={NAVY} />} label={t("profile.quick.myShop")} onPress={() => openAuth()} />
        </View>
        <View style={[styles.featGrid, { marginTop: 8 }]}>
          <Feat icon={<MapPin size={17} color={NAVY} />} label={t("address.title")} onPress={() => openAuth()} wide />
          <Feat icon={<Settings size={17} color={NAVY} />} label={t("settings.title")} onPress={() => openAuth()} wide />
        </View>
        <View style={{ marginTop: 20, alignItems: "center", gap: 10 }}>
          <Press onPress={() => openOverlay({ kind: "legal", page: "terms" })} style={{ minHeight: 0 }}>
            <Text style={{ color: `${NAVY}99`, fontSize: 12 }}>{t("legal.terms")}</Text>
          </Press>
          <Press onPress={() => openOverlay({ kind: "legal", page: "privacy" })} style={{ minHeight: 0 }}>
            <Text style={{ color: `${NAVY}99`, fontSize: 12 }}>{t("legal.privacy")}</Text>
          </Press>
          <Press onPress={() => openOverlay({ kind: "legal", page: "community" })} style={{ minHeight: 0 }}>
            <Text style={{ color: `${NAVY}99`, fontSize: 12 }}>{t("legal.community")}</Text>
          </Press>
        </View>
      </ScrollView>
    </View>
  );
}

function Feat({
  icon,
  label,
  onPress,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <Press onPress={onPress} style={[styles.feat, wide && { width: "48%" }]}>
      <Glass tone="light" intensity={44} radius={14} style={{ width: "100%" }}>
        <View style={styles.featInner}>
          {icon}
          <Text style={styles.featLabel}>{label}</Text>
        </View>
      </Glass>
    </Press>
  );
}

function AuthedProfile() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { user, signOut, becomeSeller } = useAuth();
  const { overlay, openOverlay } = useNav();
  const { dark, setDark, colors } = useAppTheme();
  const [hasCode, setHasCode] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchMyPromoCodes().then((rows) => {
      if (alive) setHasCode(rows.length > 0);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, overlay.kind]);

  if (!user) return null;

  const money = formatMoney(user.walletBalance, user.walletCurrency, i18n.language);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: TAB_SAFE_PADDING + insets.bottom }}>
      <LinearGradient colors={[NAVY, NAVY_600]} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <GlassIconButton tone="dark" onPress={() => openOverlay({ kind: "activity", tab: "notifs" })}>
              <Bell size={18} color="#fff" />
            </GlassIconButton>
            <Text style={styles.heroIconLabel}>{t("profile.hero.activity")}</Text>
          </View>
          <Press onPress={() => openOverlay({ kind: "edit-profile" })} style={{ minHeight: 0, minWidth: 0 }}>
            <View style={styles.avatarRing}>
              {isHttpUrl(user.avatarUrl) ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>{initials(user.displayName)}</Text>
                </View>
              )}
            </View>
          </Press>
          <View style={styles.heroIcon}>
            <GlassIconButton tone="dark" onPress={() => openOverlay({ kind: "activity", tab: "messages" })}>
              <MessageCircle size={18} color="#fff" />
            </GlassIconButton>
            <Text style={styles.heroIconLabel}>{t("profile.hero.message")}</Text>
          </View>
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user.displayName}</Text>
          <ReferredBadge referred={user.isReferred} size={16} />
        </View>
        <Text style={styles.handle}>@{user.handle}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Glass tone="dark" intensity={42} radius={18} style={styles.stats}>
          <View style={styles.statsRow}>
            <Stat n={user.followers} label={t("profile.stats.followers")} />
            <Stat n={user.sales} label={t("profile.stats.sales")} />
            <Stat n={user.following} label={t("profile.stats.following")} />
          </View>
        </Glass>
        <View style={styles.quick}>
          <Quick icon={<Store size={18} color={GOLD} />} label={user.isSeller ? t("profile.quick.myShop") : t("profile.quick.recharge")} onPress={() => (user.isSeller ? openOverlay({ kind: "shop" }) : openOverlay({ kind: "wallet" }))} />
          <Quick icon={<Wallet size={18} color={GOLD} />} label={t("profile.quick.wallet")} hint={money} onPress={() => openOverlay({ kind: "wallet" })} />
          <Quick
            icon={<Coins size={18} color={GOLD} />}
            label={user.isSeller ? t("profile.quick.earnings") : t("profile.quick.becomeSeller")}
            onPress={() => (user.isSeller ? openOverlay({ kind: "earnings" }) : becomeSeller())}
          />
          <Quick icon={<ShoppingBag size={18} color={GOLD} />} label={t("profile.quick.orders")} onPress={() => openOverlay({ kind: "orders" })} />
        </View>
      </LinearGradient>
      <FrozenBanner />

      {user.isSeller ? (
        <Section title={t("profile.sections.boutique")}>
          <Row tint={PROFILE_MENU_TINT.shop} icon={<Store size={16} color="#fff" />} label={t("profile.quick.myShop")} onPress={() => openOverlay({ kind: "shop" })} />
          <Row tint={PROFILE_MENU_TINT.delivery} icon={<Truck size={16} color="#fff" />} label={t("delivery.title")} onPress={() => openOverlay({ kind: "delivery" })} />
          <Row tint={PROFILE_MENU_TINT.certify} icon={<BadgeCheck size={16} color="#fff" />} label={t("verify.menuLabel")} onPress={() => openOverlay({ kind: "certification" })} />
        </Section>
      ) : null}
      <Section title={t("profile.sections.finances")}>
        <Row tint={PROFILE_MENU_TINT.wallet} icon={<Wallet size={16} color="#fff" />} label={t("profile.menu.wallet")} onPress={() => openOverlay({ kind: "wallet" })} />
        {user.isSeller ? (
          <Row tint={PROFILE_MENU_TINT.earnings} icon={<Coins size={16} color="#fff" />} label={t("profile.quick.earnings")} onPress={() => openOverlay({ kind: "earnings" })} />
        ) : null}
        {user.isSeller ? (
          <Row tint={PROFILE_MENU_TINT.payouts} icon={<CreditCard size={16} color="#fff" />} label={t("sellerPayments.title")} onPress={() => openOverlay({ kind: "seller-payments" })} />
        ) : null}
      </Section>
      <Section title={t("profile.sections.purchases")}>
        <Row tint={PROFILE_MENU_TINT.orders} icon={<ShoppingBag size={16} color="#fff" />} label={t("profile.menu.purchases")} onPress={() => openOverlay({ kind: "orders" })} />
        <Row tint={PROFILE_MENU_TINT.address} icon={<MapPin size={16} color="#fff" />} label={t("address.title")} onPress={() => openOverlay({ kind: "addresses" })} />
      </Section>
      <Section title={t("profile.sections.community")}>
        <Row
          tint={PROFILE_MENU_TINT.referral}
          icon={<HeartHandshake size={16} color="#fff" />}
          label={hasCode ? t("referral.menu") : t("referral.claim.entry")}
          onPress={() => openOverlay({ kind: "referral" })}
        />
      </Section>
      {user.isAdmin ? (
        <Section title={t("profile.sections.admin")}>
          <Row tint={PROFILE_MENU_TINT.admin} icon={<Shield size={16} color="#fff" />} label={t("admin.title")} onPress={() => openOverlay({ kind: "admin" })} />
        </Section>
      ) : null}
      <Section title={t("profile.sections.account")}>
        <Row tint={PROFILE_MENU_TINT.edit} icon={<UserPen size={16} color="#fff" />} label={t("profile.editProfile")} onPress={() => openOverlay({ kind: "edit-profile" })} />
        <Row tint={PROFILE_MENU_TINT.settings} icon={<Settings size={16} color="#fff" />} label={t("profile.menu.settings")} onPress={() => openOverlay({ kind: "settings" })} />
        <Row tint={PROFILE_MENU_TINT.discover} icon={<Lightbulb size={16} color="#fff" />} label="Découvrir" onPress={() => openOverlay({ kind: "discover" })} />
        <Row tint={PROFILE_MENU_TINT.darkMode} icon={<Moon size={16} color="#fff" />} label={t("profile.menu.darkMode")} right={<Text style={{ color: GOLD, fontWeight: "700" }}>{dark ? "ON" : "OFF"}</Text>} onPress={() => setDark(!dark)} />
        <Row tint={PROFILE_MENU_TINT.help} icon={<HelpCircle size={16} color="#fff" />} label={t("profile.menu.help")} onPress={() => openOverlay({ kind: "help" })} />
        <Row tint={PROFILE_MENU_TINT.signOut} icon={<LogOut size={16} color="#fff" />} label={t("profile.signOut")} danger onPress={signOut} />
      </Section>
      <View style={{ paddingHorizontal: 24, paddingTop: 22, alignItems: "center", gap: 10 }}>
        <Press onPress={() => openOverlay({ kind: "legal", page: "terms" })} style={{ minHeight: 0 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t("legal.terms")}</Text>
        </Press>
        <Press onPress={() => openOverlay({ kind: "legal", page: "privacy" })} style={{ minHeight: 0 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t("legal.privacy")}</Text>
        </Press>
        <Press onPress={() => openOverlay({ kind: "legal", page: "community" })} style={{ minHeight: 0 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t("legal.community")}</Text>
        </Press>
      </View>
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{n}</Text>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function Quick({ icon, label, hint, onPress }: { icon: React.ReactNode; label: string; hint?: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={styles.quickItem}>
      <Glass tone="gold" intensity={36} radius={16} elevated={false}>
        <View style={styles.quickInner}>
          {icon}
        </View>
      </Glass>
      <Text style={styles.quickLabel}>{label}</Text>
      {hint ? <Text style={styles.quickHint}>{hint}</Text> : null}
    </Press>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
      <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 0.8, color: colors.mutedForeground, marginBottom: 6 }}>{title}</Text>
      <SurfaceCard padded={false}>{children}</SurfaceCard>
    </View>
  );
}

function MenuIcon({ icon, tint }: { icon: React.ReactNode; tint: string }) {
  return <View style={[styles.menuIcon, { backgroundColor: tint }]}>{icon}</View>;
}

function Row({
  icon,
  tint,
  label,
  onPress,
  right,
  danger,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  onPress: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Press onPress={onPress} style={styles.row}>
      <MenuIcon icon={icon} tint={tint} />
      <Text style={[styles.rowLabel, { color: danger ? PROFILE_MENU_TINT.signOut : colors.foreground }]}>{label}</Text>
      {right ?? <ChevronRight size={18} color={colors.mutedForeground} />}
    </Press>
  );
}

const styles = StyleSheet.create({
  guestRoot: { flex: 1, backgroundColor: GUEST_CREAM },
  guestHead: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  guestHeadTitle: { fontSize: 15, fontWeight: "700", color: NAVY },
  guestTitle: { marginTop: 8, fontSize: 24, fontWeight: "900", color: NAVY, textAlign: "center", lineHeight: 28 },
  guestSub: { marginTop: 6, fontSize: 13, color: `${NAVY}99`, textAlign: "center", maxWidth: 280 },
  goldBtn: {
    width: "100%",
    height: 44,
    borderRadius: 999,
    backgroundColor: GOLD,
    flexDirection: "row",
    gap: 8,
  },
  goldBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  whiteBtn: {
    width: "100%",
    height: 44,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  featGrid: { flexDirection: "row", flexWrap: "wrap", width: "100%", gap: 8, marginTop: 4 },
  feat: {
    width: "23%",
    minHeight: 64,
    minWidth: 0,
    alignItems: "stretch",
  },
  featInner: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  featLabel: { fontSize: 10, fontWeight: "700", color: NAVY, textAlign: "center" },
  hero: { paddingBottom: 20, paddingHorizontal: 16 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroIcon: { minHeight: 0, alignItems: "center", width: 64 },
  heroIconLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, marginTop: 2 },
  avatarRing: { width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: GOLD, padding: 3 },
  avatar: { flex: 1, borderRadius: 44, backgroundColor: NAVY_INSET },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#fff", fontSize: 28, fontWeight: "900" },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  name: { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  handle: { color: GOLD, textAlign: "center", fontWeight: "700" },
  email: { color: "rgba(255,255,255,0.6)", textAlign: "center", fontSize: 12, marginTop: 2 },
  stats: { marginTop: 14 },
  statsRow: { flexDirection: "row", paddingVertical: 12 },
  quick: { flexDirection: "row", marginTop: 14 },
  quickItem: { flex: 1, minHeight: 0, alignItems: "center", gap: 6 },
  quickInner: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  quickLabel: { color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  quickHint: { color: GOLD, fontSize: 10, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 54, gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
