import { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  DEFI_PLUS_DURATION_MS,
  DEFI_PLUS_HIT_S,
  DEFI_PLUS_NAME_FADE_S,
  DEFI_PLUS_NAME_HOLD_S,
  PHASE,
  defiPlusRemaining,
  easeOutCubic,
  heartbeat,
  lerp,
  range,
  smootherstep,
} from "../../lib/defi-plus";
import {
  DefiPlusMotionScene,
  defiPlusMedalFrame,
  defiPlusTitlePair,
} from "./DefiPlusMotionScene";

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
  const { width: winW, height: winH } = useWindowDimensions();
  const [box, setBox] = useState({ w: winW, h: winH });
  const [elapsed, setElapsed] = useState(() =>
    active ? Math.max(0, Date.now() - (startsAt ?? Date.now())) : 0,
  );

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const start = startsAt ?? Date.now();
    let raf = 0;
    let lastUi = 0;
    const tick = () => {
      const next = Math.max(0, Date.now() - start);
      if (next - lastUi >= 32 || next >= DEFI_PLUS_DURATION_MS) {
        lastUi = next;
        setElapsed(next);
      }
      if (next < DEFI_PLUS_DURATION_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, startsAt]);

  if (!active || elapsed >= DEFI_PLUS_DURATION_MS) return null;

  const t = elapsed / 1000;
  const remaining = defiPlusRemaining(elapsed);
  const struck = t >= DEFI_PLUS_HIT_S;
  const split = range(t, DEFI_PLUS_HIT_S + 0.1, DEFI_PLUS_HIT_S + 1.3);
  const veil = lerp(0.22, 0.02, split);
  const shake =
    struck && t < DEFI_PLUS_HIT_S + 0.32
      ? Math.sin(t * 90) * (1 - range(t, DEFI_PLUS_HIT_S + 0.02, DEFI_PLUS_HIT_S + 0.32)) * 5
      : 0;
  const beat = t >= PHASE.beatStart && t < DEFI_PLUS_HIT_S ? heartbeat(t) : 0;
  const frac = t - Math.floor(t);
  const numberPop = remaining > 0 && frac < 0.18 ? 1 + (1 - frac / 0.18) * 0.18 : 1;
  const countOut = 1 - range(t, DEFI_PLUS_HIT_S + 0.35, DEFI_PLUS_HIT_S + 0.7);
  const versusIn = easeOutCubic(range(t, DEFI_PLUS_HIT_S + 0.18, DEFI_PLUS_HIT_S + 0.55));
  const namesFadeAt = DEFI_PLUS_HIT_S + 1.7 + DEFI_PLUS_NAME_HOLD_S;
  const versusOut = 1 - smootherstep(range(t, namesFadeAt, namesFadeAt + DEFI_PLUS_NAME_FADE_S));
  const versus = versusIn * versusOut;
  const hasNames = Boolean(leftName?.trim() && rightName?.trim());
  const partiAt = hasNames ? DEFI_PLUS_HIT_S + 1.22 + DEFI_PLUS_NAME_HOLD_S : DEFI_PLUS_HIT_S + 0.45;
  const partiIn = easeOutCubic(
    range(t, partiAt, hasNames ? DEFI_PLUS_HIT_S + 1.48 + DEFI_PLUS_NAME_HOLD_S : DEFI_PLUS_HIT_S + 0.82),
  );
  const partiOut = 1 - range(t, namesFadeAt, namesFadeAt + 0.45);
  const parti = partiIn * partiOut;
  const titles = defiPlusTitlePair(t, box.w, box.h);
  const medal = defiPlusMedalFrame(t, box.w, box.h);
  const medalPulse = 1 + beat * 0.14;

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 8 && height > 8) setBox({ w: width, h: height });
      }}
      style={[styles.root, { transform: [{ translateX: shake }] }]}
    >
      <View style={[styles.veil, { backgroundColor: `rgba(0,0,0,${veil})` }]} />
      <DefiPlusMotionScene t={t} width={box.w} height={box.h} />

      {titles.fade > 0.02 ? (
        <>
          <Text
            style={[
              styles.defi,
              {
                left: titles.defiX - 90,
                top: titles.cy - 28 * titles.shrink,
                opacity: titles.fade,
                transform: [{ rotate: `${titles.defiRot}deg` }, { scale: titles.shrink }],
              },
            ]}
          >
            DÉFI
          </Text>
          <Text
            style={[
              styles.plus,
              {
                left: titles.plusX - 36,
                top: titles.cy - 40 * titles.shrink,
                opacity: titles.fade,
                transform: [{ rotate: `${titles.plusRot}deg` }, { scale: titles.shrink }],
              },
            ]}
          >
            +
          </Text>
        </>
      ) : null}

      {medal.on * medal.fade > 0.02 ? (
        <>
          <MedalHalf
            cx={medal.cx - medal.dx}
            cy={medal.cy}
            r={medal.r}
            scale={medalPulse}
            opacity={medal.on * medal.fade}
            side="left"
          />
          <MedalHalf
            cx={medal.cx + medal.dx}
            cy={medal.cy}
            r={medal.r}
            scale={medalPulse}
            opacity={medal.on * medal.fade}
            side="right"
          />
        </>
      ) : null}

      {countOut > 0.02 ? (
        <View style={styles.countWrap}>
          <Text style={[styles.countHint, { opacity: countOut }]}>
            Votre Défi Plus{"\n"}commencera dans…
          </Text>
          <Text
            style={[
              styles.count,
              { opacity: countOut, transform: [{ scale: numberPop * (1 + beat * 0.08) }] },
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
          <VsMark t={t} fade={versus} />
          <Text style={[styles.vsName, styles.vsRight, { opacity: versus }]} numberOfLines={1}>
            {rightName}
          </Text>
        </View>
      ) : null}

      {t >= partiAt && parti > 0.02 ? (
        <Text style={[styles.parti, { opacity: parti }]}>C'EST PARTI!</Text>
      ) : null}
    </View>
  );
}

function MedalHalf({
  cx,
  cy,
  r,
  scale,
  opacity,
  side,
}: {
  cx: number;
  cy: number;
  r: number;
  scale: number;
  opacity: number;
  side: "left" | "right";
}) {
  const size = r * 2;
  return (
    <View
      style={{
        position: "absolute",
        left: cx - r,
        top: cy - r,
        width: size,
        height: size,
        opacity,
        transform: [{ scale }],
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: r,
          height: size,
          overflow: "hidden",
          alignSelf: side === "left" ? "flex-start" : "flex-end",
        }}
      >
        <View
          style={{
            width: size,
            height: size,
            marginLeft: side === "right" ? -r : 0,
            borderRadius: r,
            overflow: "hidden",
            borderWidth: r * 0.08,
            borderColor: "#F0C14B",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinearGradient
            colors={["#1A4EA8", "#071428", "#B8860B"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.medalDefi, { fontSize: r * 0.34 }]}>DÉFI</Text>
          <Text style={[styles.medalPlus, { fontSize: r * 0.42, marginTop: -4 }]}>+</Text>
        </View>
      </View>
    </View>
  );
}

function VsMark({ t, fade }: { t: number; fade: number }) {
  const vIn = easeOutCubic(range(t, DEFI_PLUS_HIT_S + 0.32, DEFI_PLUS_HIT_S + 0.54));
  const lineIn = easeOutCubic(range(t, DEFI_PLUS_HIT_S + 0.5, DEFI_PLUS_HIT_S + 0.74));
  const sIn = easeOutCubic(range(t, DEFI_PLUS_HIT_S + 0.68, DEFI_PLUS_HIT_S + 0.92));
  return (
    <View style={styles.vsMark}>
      <Text style={[styles.vsV, { opacity: fade * vIn, transform: [{ scale: lerp(0.7, 1, vIn) }] }]}>V</Text>
      <View
        style={[
          styles.vsSlash,
          {
            opacity: fade * lineIn,
            transform: [{ translateX: -1 }, { rotate: "28deg" }, { scaleY: lineIn }],
          },
        ]}
      />
      <Text style={[styles.vsS, { opacity: fade * sIn, transform: [{ scale: lerp(0.7, 1, sIn) }] }]}>S</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 84, overflow: "hidden" },
  veil: { ...StyleSheet.absoluteFill },
  defi: {
    position: "absolute",
    width: 180,
    textAlign: "center",
    color: "#7DD8FF",
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: "rgba(80,230,255,0.95)",
    textShadowRadius: 18,
  },
  plus: {
    position: "absolute",
    width: 72,
    textAlign: "center",
    color: "#FFF4C4",
    fontSize: 72,
    fontWeight: "900",
    textShadowColor: "rgba(255,200,70,0.95)",
    textShadowRadius: 18,
  },
  medalDefi: { color: "#FFE08A", fontWeight: "900", zIndex: 1 },
  medalPlus: { color: "#FFE08A", fontWeight: "900", zIndex: 1 },
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
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 12,
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
  vsMark: { width: 54, height: 48, position: "relative" },
  vsV: {
    position: "absolute",
    left: 0,
    top: 0,
    color: "#7DD8FF",
    fontSize: 24,
    fontWeight: "900",
    textShadowColor: "rgba(80,220,255,0.95)",
    textShadowRadius: 12,
  },
  vsSlash: {
    position: "absolute",
    left: 26,
    top: 1,
    width: 2,
    height: 46,
    backgroundColor: "#fff",
  },
  vsS: {
    position: "absolute",
    right: 0,
    bottom: 0,
    color: "#F5C542",
    fontSize: 24,
    fontWeight: "900",
    textShadowColor: "rgba(255,200,70,0.95)",
    textShadowRadius: 12,
  },
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
