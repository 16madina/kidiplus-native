import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Crown } from "lucide-react-native";
import { Press } from "../Press";
import { Logo } from "../Logo";
import { battleResultView } from "../../lib/battle-result";
import { formatMoney } from "../../lib/money";
import type { HydratedBattle } from "../../lib/battles";
import { GOLD, NAVY } from "../../theme";

export function BattleResultOverlay({
  open,
  battle,
  selfSellerId,
  onDone,
  onRematch,
}: {
  open: boolean;
  battle: HydratedBattle | null;
  selfSellerId?: string | null;
  onDone: () => void;
  onRematch?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [phase, setPhase] = useState<"logo" | "card">("logo");

  useEffect(() => {
    if (!open || !battle) {
      setPhase("logo");
      return;
    }
    setPhase("logo");
    const id = setTimeout(() => setPhase("card"), 900);
    return () => clearTimeout(id);
  }, [open, battle?.session.id]);

  if (!open || !battle) return null;
  const view = battleResultView(battle, selfSellerId);
  const showRematch = !!onRematch && view.showRematch;

  return (
    <View style={styles.root}>
      {phase === "logo" ? (
        <Logo size={56} onDark />
      ) : (
        <View style={styles.card}>
          <Text style={styles.heading}>{t("battle.result.heading")}</Text>
          <Text style={styles.brand}>{t("battle.brand")}</Text>
          {view.abandon ? (
            <>
              <Text style={styles.title}>
                {battle.session.end_reason === "forfeit"
                  ? t("battle.result.opponentForfeit", { name: view.leftName || t("battle.result.opponentFallback") })
                  : t("battle.result.opponentOffline", { name: view.leftName || t("battle.result.opponentFallback") })}
              </Text>
              <Text style={styles.goldLine}>
                {view.winner
                  ? view.youWon
                    ? t("battle.result.forfeitWinYou")
                    : t("battle.result.forfeitWin", { name: view.winner.displayName })
                  : t("battle.result.challengeOver")}
              </Text>
            </>
          ) : view.winner ? (
            <>
              <View style={styles.crown}>
                <Crown size={28} color={NAVY} />
              </View>
              <Text style={styles.title}>{t("battle.result.win", { name: view.winner.displayName })}</Text>
              <Text style={styles.score}>
                {t("battle.result.scoreline", {
                  winnerAmount: formatMoney(view.winner.scoreAmountLive, battle.session.currency, i18n.language),
                  loserAmount: formatMoney(view.loser?.scoreAmountLive ?? 0, battle.session.currency, i18n.language),
                })}
              </Text>
              <Text style={styles.goldLine}>{t("battle.result.champion", { name: view.winner.displayName })}</Text>
            </>
          ) : (
            <Text style={styles.title}>{t("battle.result.tie")}</Text>
          )}
          {!view.abandon ? <Text style={styles.note}>{t("battle.result.pendingNote")}</Text> : null}
          {showRematch ? (
            <Press onPress={onRematch} style={styles.primary}>
              <Text style={styles.primaryTxt}>{t("battle.result.rematch")}</Text>
            </Press>
          ) : null}
          <Press onPress={onDone} style={showRematch ? styles.secondary : styles.primary}>
            <Text style={showRematch ? styles.secondaryTxt : styles.primaryTxt}>
              {t("battle.result.continue")}
            </Text>
          </Press>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: "#1a1710",
    borderWidth: 1,
    borderColor: "rgba(232,185,59,0.45)",
    alignItems: "center",
  },
  heading: {
    color: GOLD,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  brand: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600", marginTop: 4, marginBottom: 12 },
  crown: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center", lineHeight: 28 },
  score: { color: "rgba(255,255,255,0.8)", fontSize: 14, textAlign: "center", marginTop: 8 },
  goldLine: { color: GOLD, fontSize: 16, fontWeight: "800", textAlign: "center", marginTop: 8 },
  note: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", marginTop: 16 },
  primary: {
    marginTop: 20,
    height: 48,
    width: "100%",
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  primaryTxt: { color: NAVY, fontWeight: "900", fontSize: 14 },
  secondary: {
    marginTop: 8,
    height: 48,
    width: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  secondaryTxt: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
