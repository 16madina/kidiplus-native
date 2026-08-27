import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Cpu, Wallet } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { formatMoney, normalizeCurrency } from "../../lib/money";
import type { ReferralBalance } from "../../lib/referrals";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const GOLD_DEEP = "#8A6511";
const GOLD_MID = "#C8992E";
const GOLD_LIGHT = "#F5D273";
const GOLD_HIGHLIGHT = "#FFF1B8";
const INK = "#1A130A";

export function ReferralWalletCard({
  balance,
  fallbackCurrency,
}: {
  balance: ReferralBalance | null;
  fallbackCurrency: string;
}) {
  const { t, i18n } = useTranslation();
  const cur = balance?.currency ?? fallbackCurrency;
  const available = balance?.available ?? 0;

  return (
    <View style={styles.shadow}>
      <LinearGradient
        colors={[GOLD_LIGHT, GOLD_MID, GOLD_DEEP]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <LinearGradient
          colors={[`${GOLD_HIGHLIGHT}CC`, "transparent"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.55, y: 0.55 }}
          style={FILL}
          pointerEvents="none"
        />
        <View style={styles.streaks} pointerEvents="none" />
        <View style={styles.glow} pointerEvents="none" />

        <View style={styles.top}>
          <View>
            <Text style={styles.tagline}>{t("referral.wallet.tagline")}</Text>
            <Text style={styles.partner}>{t("referral.wallet.partner")}</Text>
          </View>
          <LinearGradient colors={["#FFE7A8", "#C9971F", "#7A5A10"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
            <Cpu size={16} color="rgba(0,0,0,0.55)" />
          </LinearGradient>
        </View>

        <View style={styles.markWrap}>
          <Text style={styles.mark}>
            KiDi<Text style={styles.plus}>+</Text>
          </Text>
        </View>

        <View style={styles.bottom}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.walletRow}>
              <Wallet size={10} color={INK} />
              <Text style={styles.walletLbl}>{t("referral.wallet.title")}</Text>
            </View>
            <Text style={styles.amount} numberOfLines={1}>
              {formatMoney(available, normalizeCurrency(cur), i18n.language)}
            </Text>
          </View>
          <View style={styles.curBadge}>
            <Text style={styles.curTxt}>{normalizeCurrency(cur)}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 22,
    shadowColor: GOLD_DEEP,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  card: {
    minHeight: 200,
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
  },
  streaks: {
    ...FILL,
    opacity: 0.22,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  glow: {
    position: "absolute",
    right: -80,
    bottom: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: `${GOLD_HIGHLIGHT}66`,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tagline: {
    color: INK,
    opacity: 0.75,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.8,
    textTransform: "uppercase",
  },
  partner: {
    marginTop: 4,
    color: INK,
    opacity: 0.6,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  chip: {
    width: 48,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  markWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 18 },
  mark: {
    color: INK,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -0.6,
    textShadowColor: "rgba(255,255,255,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  plus: { color: "#3a0f0f" },
  bottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  walletRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  walletLbl: {
    color: INK,
    opacity: 0.7,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  amount: { marginTop: 6, color: INK, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] },
  curBadge: { backgroundColor: "rgba(0,0,0,0.12)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  curTxt: { color: INK, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
});
