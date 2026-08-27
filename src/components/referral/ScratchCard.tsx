import { useRef, useState, type ReactNode } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Cpu, Sparkles } from "lucide-react-native";
import { Press } from "../Press";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const GOLD_DEEP = "#8A6511";
const GOLD_MID = "#C8992E";
const GOLD_LIGHT = "#F5D273";
const GOLD_HIGHLIGHT = "#FFF1B8";
const INK = "#1A130A";
const COLS = 8;
const ROWS = 6;

export function ScratchCard({
  children,
  scratchLabel,
  skipLabel,
  brandLabel,
}: {
  children: ReactNode;
  scratchLabel: string;
  skipLabel: string;
  brandLabel: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const cells = useRef(new Set<string>());
  const wrap = useRef({ w: 1, h: 1 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !revealed,
      onMoveShouldSetPanResponder: () => !revealed,
      onPanResponderGrant: (e) => mark(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => mark(e.nativeEvent.locationX, e.nativeEvent.locationY),
    }),
  ).current;

  const mark = (x: number, y: number) => {
    if (revealed) return;
    const { w, h } = wrap.current;
    const c = Math.max(0, Math.min(COLS - 1, Math.floor((x / w) * COLS)));
    const r = Math.max(0, Math.min(ROWS - 1, Math.floor((y / h) * ROWS)));
    cells.current.add(`${c}:${r}`);
    if (cells.current.size / (COLS * ROWS) >= 0.45) setRevealed(true);
  };

  return (
    <View>
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
        <View style={styles.top}>
          <LinearGradient colors={["#FFE7A8", "#C9971F", "#7A5A10"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
            <Cpu size={16} color="rgba(0,0,0,0.55)" />
          </LinearGradient>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.brand}>{brandLabel}</Text>
            <Text style={styles.mark}>
              KiDi<Text style={styles.plus}>+</Text>
            </Text>
          </View>
        </View>

        <View
          style={styles.well}
          onLayout={(e) => {
            wrap.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
          }}
        >
          <View style={styles.inner}>{children}</View>
          {!revealed ? (
            <View style={styles.foil} {...pan.panHandlers}>
              <LinearGradient
                colors={[GOLD_LIGHT, GOLD_MID, GOLD_DEEP]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={FILL}
              />
              <View style={styles.hint}>
                <Sparkles size={12} color="#fff" />
                <Text style={styles.hintTxt}>{scratchLabel}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </LinearGradient>
      {!revealed ? (
        <Press onPress={() => setRevealed(true)} style={styles.skip}>
          <Text style={styles.skipTxt}>{skipLabel}</Text>
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 280,
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
    shadowColor: GOLD_DEEP,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  chip: {
    width: 48,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: INK,
    opacity: 0.85,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.8,
    textTransform: "uppercase",
  },
  mark: { marginTop: 2, color: INK, fontSize: 18, fontWeight: "900" },
  plus: { color: "#3a0f0f" },
  well: {
    marginTop: 16,
    minHeight: 190,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    overflow: "hidden",
  },
  inner: { padding: 16 },
  foil: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  hintTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  skip: { marginTop: 8, minHeight: 36 },
  skipTxt: { color: "#6B7289", fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
});
