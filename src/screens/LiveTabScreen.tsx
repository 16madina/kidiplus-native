import { useCallback, useEffect, useState } from "react";
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Calendar as CalendarIcon, Gavel, LogIn, Radio, Sparkles, Store, TrendingUp, UserPlus, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Logo } from "../components/Logo";
import { Press } from "../components/Press";
import { Glass, GlassIcon, GlassIconButton } from "../components/Glass";
import { TAB_SAFE_PADDING } from "../components/BottomTabBar";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { GOLD, GOLD_GO_LIVE, GOLD_GUEST, GUEST_CREAM, NAVY } from "../theme";
import { cancelScheduledLiveInDb, fetchMyScheduledLives, type ScheduledLiveRow } from "../lib/lives";

const guestHero = require("../../assets/guest/guest-live-hero.jpg");
const liveLogo = require("../../assets/brand/kidi-live-logo-v3.png");
const sellerHero = require("../../assets/guest/seller-hero.jpg");
const startBg = require("../../assets/golive/golive-start-bg.jpg");
const scheduleBg = require("../../assets/golive/golive-schedule-bg.jpg");

export function LiveTabScreen() {
  const { guestMode, user, openAuth, becomeSeller } = useAuth();
  if (guestMode || !user) return <GuestLive />;
  if (!user.isSeller) return <BecomeSeller onActivate={becomeSeller} />;
  return <GoLiveEntry />;
}

function GuestLive() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { openAuth } = useAuth();
  return (
    <View style={styles.root}>
      <ImageBackground source={guestHero} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(251,246,236,0.96)", "rgba(251,246,236,0.45)", "rgba(251,246,236,0.35)", "rgba(251,246,236,0.92)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.guestInner, { paddingTop: insets.top + 16, paddingBottom: TAB_SAFE_PADDING + insets.bottom }]}>
        <Image source={liveLogo} style={styles.liveLogo} contentFit="contain" />
        <Text style={styles.guestTitle}>{t("guest.live.title", { defaultValue: "Crée un compte pour vendre en live" })}</Text>
        <Text style={styles.guestSub}>{t("guest.live.subtitle", { defaultValue: "Lance ton live shopping en quelques secondes et vends à ta communauté." })}</Text>
        <View style={{ flex: 1, width: "100%", marginTop: 16 }}>
          <View style={[styles.pill, { top: "8%", left: -8 }]}>
            <Glass tone="dark" intensity={40} radius={999}>
              <View style={styles.pillInner}>
                <Radio size={14} color="#fff" />
                <Text style={styles.pillText}>{t("guest.live.pill1", { defaultValue: "Prêt à démarrer un live ?" })}</Text>
              </View>
            </Glass>
          </View>
          <View style={[styles.pill, { top: "38%", right: -8, alignSelf: "flex-end" }]}>
            <Glass tone="gold" intensity={44} radius={999}>
              <View style={styles.pillInner}>
                <Gavel size={14} color="#fff" />
                <Text style={styles.pillText}>{t("guest.live.pill2", { defaultValue: "Vends aux enchères en direct" })}</Text>
              </View>
            </Glass>
          </View>
          <View style={[styles.pill, { top: "68%", left: 16 }]}>
            <Glass tone="dark" intensity={40} radius={999}>
              <View style={styles.pillInner}>
                <Sparkles size={14} color="#fff" />
                <Text style={styles.pillText}>{t("guest.live.pill3", { defaultValue: "Crée ton compte gratuitement" })}</Text>
              </View>
            </Glass>
          </View>
        </View>
        <Press onPress={() => openAuth("signup")} style={[styles.cta, { backgroundColor: GOLD_GUEST }]}>
          <UserPlus size={16} color="#fff" />
          <Text style={styles.ctaText}>{t("auth.welcome.signUp")}</Text>
        </Press>
        <Press onPress={() => openAuth("signin")} style={[styles.cta, { backgroundColor: NAVY, marginTop: 10 }]}>
          <LogIn size={16} color="#fff" />
          <Text style={styles.ctaText}>{t("auth.welcome.signIn")}</Text>
        </Press>
      </View>
    </View>
  );
}

function BecomeSeller({ onActivate }: { onActivate: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { openOverlay } = useNav();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ paddingBottom: TAB_SAFE_PADDING + insets.bottom }}
    >
      <ImageBackground
        source={sellerHero}
        style={[styles.sellerHero, { paddingTop: insets.top }]}
        resizeMode="cover"
      />
      <View style={{ alignItems: "center", paddingHorizontal: 24, marginTop: -16 }}>
        <Text style={styles.sellerTitle}>{t("broadcast.seller.title", { defaultValue: "Vends en direct sur KiDi+" })}</Text>
        <Text style={styles.sellerSub}>
          {t("broadcast.seller.subtitle", { defaultValue: "Crée tes lives, présente tes articles et laisse les acheteurs enchérir en temps réel." })}
        </Text>
        <View style={styles.feats}>
          <Feat icon={<Radio size={22} color={NAVY} />} label={t("broadcast.seller.f1", { defaultValue: "Lance ton live" })} />
          <View style={styles.featDiv} />
          <Feat icon={<Gavel size={22} color={NAVY} />} label={t("broadcast.seller.f2", { defaultValue: "Reçois des enchères" })} />
          <View style={styles.featDiv} />
          <Feat icon={<TrendingUp size={22} color={NAVY} />} label={t("broadcast.seller.f3", { defaultValue: "Développe tes ventes" })} />
        </View>
        <Press
          onPress={() => {
            onActivate();
            openOverlay({ kind: "shop" });
          }}
          style={styles.goldCta}
        >
          <Text style={styles.goldCtaText}>{t("broadcast.seller.cta", { defaultValue: "Activer mon espace vendeur" })}</Text>
          <ArrowRight size={20} color={NAVY} strokeWidth={2.4} />
        </Press>
        <Text style={{ marginTop: 12, fontSize: 12, color: `${NAVY}80` }}>
          {t("broadcast.seller.free", { defaultValue: "Activation rapide et gratuite." })}
        </Text>
      </View>
    </ScrollView>
  );
}

function Feat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
      <Glass tone="gold" intensity={36} radius={16} elevated={false}>
        <View style={styles.featIcon}>{icon}</View>
      </Glass>
      <Text style={{ fontSize: 12, fontWeight: "700", textAlign: "center", color: NAVY }}>{label}</Text>
    </View>
  );
}

function GoLiveEntry() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openOverlay, setTab, overlay } = useNav();
  const [scheduled, setScheduled] = useState<ScheduledLiveRow[]>([]);

  const loadScheduled = useCallback(async () => {
    if (!user?.id) return;
    setScheduled(await fetchMyScheduledLives(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (overlay.kind === "none") void loadScheduled();
  }, [overlay.kind, loadScheduled]);

  const cancelLive = (row: ScheduledLiveRow) => {
    Alert.alert(t("golive.entry.confirmCancelTitle"), t("golive.entry.confirmCancelBody"), [
      { text: t("common.cancel", { defaultValue: "Non" }), style: "cancel" },
      {
        text: t("common.confirm", { defaultValue: "Annuler le live" }),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await cancelScheduledLiveInDb(row.id);
              await loadScheduled();
            } catch {
              /* ignore */
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.goRoot}>
      <View style={[styles.goTop, { paddingTop: insets.top + 2 }]}>
        <GlassIconButton tone="dark" onPress={() => setTab("home")}>
          <X size={20} color="#fff" />
        </GlassIconButton>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Logo size={36} />
          <View style={styles.goldLine} />
        </View>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_SAFE_PADDING + insets.bottom }}>
        <Text style={styles.goTitle}>{t("golive.entry.title")}</Text>
        <Text style={styles.goSub}>{t("golive.entry.subtitle")}</Text>
        <View style={styles.choiceRow}>
          <Press onPress={() => openOverlay({ kind: "broadcast-setup", mode: "now" })} style={styles.choice}>
            <Image source={startBg} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Glass tone="dark" intensity={28} radius={8} elevated={false} style={styles.choiceBadge}>
              <Text style={styles.choiceBadgeText}>EN DIRECT</Text>
            </Glass>
            <Radio size={22} color={GOLD_GO_LIVE} strokeWidth={2.4} />
            <Text style={styles.choiceTitle}>{t("golive.entry.startNow")}</Text>
            <Text style={styles.choiceSub}>{t("golive.entry.startNowSub")}</Text>
          </Press>
          <Press onPress={() => openOverlay({ kind: "broadcast-setup", mode: "schedule" })} style={styles.choice}>
            <Image source={scheduleBg} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Glass tone="gold" intensity={32} radius={8} elevated={false} style={styles.choiceBadge}>
              <Text style={[styles.choiceBadgeText, { color: "#fff" }]}>PLANIFIER</Text>
            </Glass>
            <CalendarIcon size={22} color={GOLD_GO_LIVE} strokeWidth={2.4} />
            <Text style={styles.choiceTitle}>{t("golive.entry.schedule")}</Text>
            <Text style={styles.choiceSub}>{t("golive.entry.scheduleSub")}</Text>
          </Press>
        </View>
        <Text style={styles.publishTitle}>{t("publish.sectionTitle", { defaultValue: "Publier du contenu" })}</Text>
        <Press onPress={() => setTab("vitrine")} style={styles.publishCta}>
          <Store size={18} color={NAVY} />
          <Text style={{ fontWeight: "800", color: NAVY }}>Publier une photo ou une vidéo</Text>
        </Press>
        <Text style={[styles.publishTitle, { marginTop: 8 }]}>{t("golive.entry.myScheduled")}</Text>
        {scheduled.length === 0 ? (
          <Glass tone="gold" intensity={36} radius={22} style={{ marginHorizontal: 16 }}>
            <View style={styles.emptySched}>
              <GlassIcon tone="gold" size={44}>
                <CalendarIcon size={22} color={GOLD_GO_LIVE} />
              </GlassIcon>
              <Text style={{ flex: 1, color: "#fff", fontWeight: "700", fontSize: 13.5 }}>{t("golive.entry.emptyScheduled")}</Text>
              <Press onPress={() => openOverlay({ kind: "broadcast-setup", mode: "schedule" })} style={styles.planBtn}>
                <Text style={{ color: GOLD_GO_LIVE, fontWeight: "800", fontSize: 12 }}>Programmer</Text>
              </Press>
            </View>
          </Glass>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {scheduled.map((row) => {
              const when = row.scheduled_at
                ? new Date(row.scheduled_at).toLocaleString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <Glass key={row.id} tone="dark" intensity={36} radius={18} elevated={false}>
                  <View style={styles.schedRow}>
                    {row.cover_url ? (
                      <Image source={{ uri: row.cover_url }} style={styles.schedCover} contentFit="cover" />
                    ) : (
                      <View style={[styles.schedCover, { backgroundColor: "#1C2440" }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "800" }} numberOfLines={1}>
                        {row.title}
                      </Text>
                      <Text style={{ color: GOLD_GO_LIVE, marginTop: 2, fontSize: 12, fontWeight: "700" }}>{when}</Text>
                    </View>
                    <Press onPress={() => cancelLive(row)} style={styles.cancelBtn}>
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>Annuler</Text>
                    </Press>
                  </View>
                </Glass>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GUEST_CREAM },
  guestInner: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  liveLogo: { width: 64, height: 64, marginTop: 16 },
  guestTitle: { marginTop: 12, fontSize: 22, fontWeight: "900", color: NAVY, textAlign: "center" },
  guestSub: { marginTop: 8, fontSize: 14, color: `${NAVY}B3`, textAlign: "center", maxWidth: 280 },
  pill: {
    position: "absolute",
  },
  pillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  cta: {
    width: "100%",
    height: 48,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  sellerHero: { height: 320, backgroundColor: NAVY, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  sellerTitle: { fontSize: 26, fontWeight: "900", color: NAVY, textAlign: "center" },
  sellerSub: { marginTop: 12, fontSize: 14, color: `${NAVY}99`, textAlign: "center", maxWidth: 320 },
  feats: { flexDirection: "row", width: "100%", maxWidth: 360, marginTop: 24 },
  featDiv: { width: 1, height: 48, alignSelf: "center", backgroundColor: `${NAVY}22` },
  featIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  goldCta: {
    marginTop: 28,
    width: "100%",
    maxWidth: 360,
    height: 56,
    borderRadius: 999,
    backgroundColor: GOLD_GUEST,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  goldCtaText: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "900", color: NAVY },
  goRoot: { flex: 1, backgroundColor: "#061331" },
  goTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 6 },
  goldLine: { marginTop: 4, height: 1, width: 96, backgroundColor: GOLD_GO_LIVE },
  goTitle: { marginTop: 12, fontSize: 30, fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: -0.4 },
  goSub: { marginTop: 8, fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center", paddingHorizontal: 28 },
  choiceRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 16 },
  choice: {
    flex: 1,
    height: 210,
    borderRadius: 22,
    overflow: "hidden",
    padding: 14,
    justifyContent: "flex-end",
    minHeight: 0,
    minWidth: 0,
    alignItems: "flex-start",
    backgroundColor: "#0B1938",
  },
  choiceBadge: { position: "absolute", top: 12, left: 12 },
  choiceBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 4 },
  choiceTitle: { color: "#fff", fontWeight: "800", fontSize: 15, marginTop: 8 },
  choiceSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  publishTitle: { color: "#fff", fontWeight: "800", fontSize: 15, paddingHorizontal: 20, marginTop: 20, marginBottom: 8 },
  publishCta: {
    marginHorizontal: 16,
    height: 48,
    borderRadius: 16,
    backgroundColor: GOLD,
    flexDirection: "row",
    gap: 8,
  },
  emptySched: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  planBtn: {
    minHeight: 36,
    height: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: GOLD_GO_LIVE,
  },
  schedRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  schedCover: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#1C2440" },
  cancelBtn: {
    minHeight: 32,
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: "rgba(229,57,63,0.85)",
  },
});
