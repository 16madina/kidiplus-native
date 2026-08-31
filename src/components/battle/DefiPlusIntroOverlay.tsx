import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  DEFI_PLUS_DURATION_MS,
  DEFI_PLUS_HIT_S,
  DEFI_PLUS_NAME_HOLD_S,
  PHASE,
  defiPlusRemaining,
  easeOutCubic,
  heartbeat,
  lerp,
  range,
} from "../../lib/defi-plus";

export function DefiPlusIntroOverlay({
  active,
  startsAt,
  leftName,
  rightName,
}: {
  active: boolean;
  startsAt?: number | null;
  leftName?: string;
  rightName?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const start = startsAt ?? Date.now();
    setElapsed(Math.max(0, Date.now() - start));
    const id = setInterval(() => {
      setElapsed(Math.max(0, Date.now() - start));
    }, 50);
    return () => clearInterval(id);
  }, [active, startsAt]);

  if (!active || elapsed >= DEFI_PLUS_DURATION_MS) return null;

  const t = elapsed / 1000;
  const remaining = defiPlusRemaining(elapsed);
  const struck = t >= DEFI_PLUS_HIT_S;
  const split = range(t, DEFI_PLUS_HIT_S + 0.1, DEFI_PLUS_HIT_S + 1.3);
  const shake =
    struck && t < DEFI_PLUS_HIT_S + 0.32
      ? Math.sin(t * 90) * (1 - range(t, DEFI_PLUS_HIT_S + 0.02, DEFI_PLUS_HIT_S + 0.32)) * 5
      : 0;
  const beat = t >= PHASE.beatStart && t < DEFI_PLUS_HIT_S ? heartbeat(t) : 0;
  const titlesIn = easeOutCubic(range(t, 0, PHASE.enterEnd));
  const titlesOut = 1 - range(t, PHASE.medalReady, PHASE.medalReady + 0.8);
  const medal = easeOutCubic(range(t, PHASE.braidEnd, PHASE.medalReady));
  const medalOut = 1 - range(t, DEFI_PLUS_HIT_S, DEFI_PLUS_HIT_S + 0.55);
  const countOut = 1 - range(t, DEFI_PLUS_HIT_S + 0.35, DEFI_PLUS_HIT_S + 0.7);
  const versusIn = easeOutCubic(range(t, DEFI_PLUS_HIT_S + 0.18, DEFI_PLUS_HIT_S + 0.55));
  const versusOut =
    1 - range(t, DEFI_PLUS_HIT_S + 1.15 + DEFI_PLUS_NAME_HOLD_S, DEFI_PLUS_HIT_S + 1.7 + DEFI_PLUS_NAME_HOLD_S);
  const versus = versusIn * versusOut;
  const hasNames = Boolean(leftName?.trim() && rightName?.trim());
  const partiAt = hasNames ? DEFI_PLUS_HIT_S + 1.22 + DEFI_PLUS_NAME_HOLD_S : DEFI_PLUS_HIT_S + 0.45;
  const partiIn = easeOutCubic(
    range(t, partiAt, hasNames ? DEFI_PLUS_HIT_S + 1.48 + DEFI_PLUS_NAME_HOLD_S : DEFI_PLUS_HIT_S + 0.82),
  );

  return (
    <View pointerEvents="none" style={[styles.root, { transform: [{ translateX: shake }] }]}>
      <View style={styles.veil} />
      {titlesIn * titlesOut > 0.02 ? (
        <View style={styles.titleRow}>
          <Text style={[styles.defi, { opacity: titlesIn * titlesOut, transform: [{ translateX: lerp(-80, 0, titlesIn) }] }]}>
            DÉFI
          </Text>
          <Text style={[styles.plus, { opacity: titlesIn * titlesOut, transform: [{ translateX: lerp(80, 0, titlesIn) }] }]}>
            +
          </Text>
        </View>
      ) : null}
      {medal * medalOut > 0.02 ? (
        <View
          style={[
            styles.medal,
            {
              opacity: medal * medalOut,
              transform: [{ scale: 1 + beat * 0.08 }],
            },
          ]}
        >
          <Text style={styles.medalTxt}>DÉFI+</Text>
        </View>
      ) : null}
      {countOut > 0.02 ? (
        <View style={styles.countWrap}>
          <Text style={[styles.countHint, { opacity: countOut }]}>
            Votre Défi Plus{"\n"}commencera dans…
          </Text>
          <Text
            style={[
              styles.count,
              { opacity: countOut, transform: [{ scale: 1 + beat * 0.08 }] },
            ]}
          >
            {remaining}
          </Text>
        </View>
      ) : null}
      {hasNames && versus > 0.02 ? (
        <View style={styles.vsRow}>
          <Text style={[styles.vsName, styles.vsLeft, { opacity: versus }]} numberOfLines={1}>
            {leftName}
          </Text>
          <Text style={[styles.vsMark, { opacity: versus }]}>VS</Text>
          <Text style={[styles.vsName, styles.vsRight, { opacity: versus }]} numberOfLines={1}>
            {rightName}
          </Text>
        </View>
      ) : null}
      {t >= partiAt && partiIn > 0.02 ? (
        <Text style={[styles.parti, { opacity: partiIn }]}>C'EST PARTI!</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 84 },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  titleRow: {
    position: "absolute",
    top: "28%",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  defi: {
    color: "#50E6FF",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 2,
    textShadowColor: "rgba(80,230,255,0.9)",
    textShadowRadius: 18,
  },
  plus: {
    color: "#E8B93B",
    fontSize: 48,
    fontWeight: "900",
    textShadowColor: "rgba(232,185,59,0.9)",
    textShadowRadius: 18,
  },
  medal: {
    position: "absolute",
    alignSelf: "center",
    top: "32%",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#10162B",
    borderWidth: 3,
    borderColor: "#E8B93B",
    alignItems: "center",
    justifyContent: "center",
  },
  medalTxt: { color: "#50E6FF", fontWeight: "900", fontSize: 14 },
  countWrap: {
    position: "absolute",
    top: "56%",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  countHint: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  count: {
    color: "#fff",
    fontSize: 96,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(80,230,255,0.95)",
    textShadowRadius: 24,
  },
  vsRow: {
    position: "absolute",
    top: "38%",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  vsName: {
    width: "40%",
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  vsLeft: { textAlign: "left", textShadowColor: "rgba(80,230,255,0.9)", textShadowRadius: 12 },
  vsRight: { textAlign: "right", textShadowColor: "rgba(255,200,70,0.9)", textShadowRadius: 12 },
  vsMark: { color: "#E8B93B", fontWeight: "900", fontSize: 18 },
  parti: {
    position: "absolute",
    top: "56%",
    left: 16,
    right: 16,
    textAlign: "center",
    color: "#E8B93B",
    fontSize: 36,
    fontWeight: "900",
    fontStyle: "italic",
  },
});
