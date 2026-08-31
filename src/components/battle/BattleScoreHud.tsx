import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { formatMoney } from "../../lib/money";
import { formatBattleClock, type BattleFighterView } from "../../lib/battle-timing";
import type { BattleSessionRow } from "../../lib/battles";
import { GOLD } from "../../theme";

export function BattleScoreHud({
  session,
  remainingMs,
  left,
  right,
}: {
  session: BattleSessionRow;
  remainingMs: number;
  left: BattleFighterView;
  right: BattleFighterView;
}) {
  const { t, i18n } = useTranslation();
  const leftLeads = left.scoreAmountLive > right.scoreAmountLive;
  const rightLeads = right.scoreAmountLive > left.scoreAmountLive;

  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.row}>
        <HudBanner
          name={left.displayName}
          amount={formatMoney(left.scoreAmountLive, session.currency, i18n.language)}
          items={left.scoreItems}
          crown={leftLeads}
          side="left"
        />
        <View style={styles.clock}>
          <Text style={styles.clockLabel}>{t("battle.headline")}</Text>
          <Text style={styles.clockTime}>{formatBattleClock(remainingMs)}</Text>
          {session.sudden_death || session.status === "sudden_death" ? (
            <Text style={styles.clockSudden}>{t("battle.sudden.clock")}</Text>
          ) : null}
        </View>
        <HudBanner
          name={right.displayName}
          amount={formatMoney(right.scoreAmountLive, session.currency, i18n.language)}
          items={right.scoreItems}
          crown={rightLeads}
          side="right"
        />
      </View>
      <Text style={styles.hint}>
        {session.sudden_death || session.status === "sudden_death"
          ? t("battle.sudden.hint")
          : t("battle.hud.provisional")}
      </Text>
    </View>
  );
}

function HudBanner({
  name,
  amount,
  items,
  crown,
  side,
}: {
  name: string;
  amount: string;
  items: number;
  crown: boolean;
  side: "left" | "right";
}) {
  const { t } = useTranslation();
  const isLeft = side === "left";
  return (
    <LinearGradient
      colors={isLeft ? ["#1d4ed8", "#1e3a8a"] : ["#e8c547", "#b8860b"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.banner, isLeft ? styles.bannerLeft : styles.bannerRight]}
    >
      <Text
        style={[styles.name, { color: isLeft ? "#fff" : "#1a1408", textAlign: isLeft ? "left" : "right" }]}
        numberOfLines={1}
      >
        {crown ? `${t("battle.hud.crown")} ` : ""}
        {name}
      </Text>
      <Text
        style={[
          styles.items,
          { color: isLeft ? "rgba(255,255,255,0.7)" : "rgba(26,20,8,0.55)", textAlign: isLeft ? "left" : "right" },
        ]}
      >
        {t("battle.hud.items", { count: items })}
      </Text>
      <Text
        style={[styles.amount, { color: isLeft ? "#f6d365" : "#1a1408", textAlign: isLeft ? "left" : "right" }]}
      >
        {amount}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 8 },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  banner: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 6 },
  bannerLeft: { paddingRight: 18 },
  bannerRight: { paddingLeft: 18 },
  name: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  items: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  amount: { fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] },
  clock: {
    zIndex: 2,
    marginHorizontal: -8,
    minWidth: 90,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#0b1020",
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  clockLabel: {
    color: "#f0d36a",
    fontSize: 8,
    fontWeight: "900",
    textAlign: "center",
  },
  clockTime: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    lineHeight: 22,
    marginTop: 2,
  },
  clockSudden: {
    color: "#f0d36a",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  hint: {
    marginTop: 2,
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "500",
  },
});
