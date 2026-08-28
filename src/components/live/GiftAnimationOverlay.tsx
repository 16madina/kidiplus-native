import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { giftByKey, type GiftKey } from "../../lib/gifts";
import { GOLD } from "../../theme";

const SCREEN_W = Dimensions.get("window").width;

export type GiftTrigger = {
  id?: string;
  giftKey: GiftKey | string;
  fromName: string;
  at: number;
};

const DURATIONS: Partial<Record<string, number>> = {
  rose: 2000,
  heart: 2000,
  diamond: 2500,
  crown: 3000,
  rocket: 3000,
  lion: 4000,
  butterfly: 2000,
  star: 2000,
  kidi: 4000,
};

type Item = GiftTrigger & { animId: string };

/** Distinct full-screen choreography per gift — display only, no money math. */
export function GiftAnimationOverlay({ trigger }: { trigger: GiftTrigger | null }) {
  const [active, setActive] = useState<Item | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!trigger) return;
    const key = trigger.id || `${trigger.giftKey}-${trigger.at}`;
    if (seen.current.has(key)) return;
    if (Date.now() - trigger.at > 20_000) return;
    seen.current.add(key);
    if (seen.current.size > 40) {
      seen.current = new Set(Array.from(seen.current).slice(-20));
    }
    setActive({ ...trigger, animId: key });
  }, [trigger?.id, trigger?.at, trigger?.giftKey]);

  if (!active) return null;
  const dur = DURATIONS[active.giftKey] ?? 2000;
  return (
    <View pointerEvents="none" style={styles.layer}>
      <GiftAnim
        key={active.animId}
        item={active}
        dur={dur}
        onDone={() => setActive((cur) => (cur?.animId === active.animId ? null : cur))}
      />
    </View>
  );
}

function GiftAnim({ item, dur, onDone }: { item: Item; dur: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, dur);
    return () => clearTimeout(t);
  }, [dur, onDone]);

  const g = giftByKey(String(item.giftKey));
  const key = (g?.key ?? item.giftKey) as string;
  switch (key) {
    case "rose":
      return <RoseAnim />;
    case "heart":
      return <HeartAnim />;
    case "diamond":
      return <DiamondAnim />;
    case "crown":
      return <CrownAnim />;
    case "rocket":
      return <RocketAnim />;
    case "lion":
      return <LionAnim name={item.fromName} />;
    default:
      return <SimpleEmoji emoji={g?.emoji ?? "🎁"} />;
  }
}

function useProgress(ms: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true }).start();
  }, [ms, v]);
  return v;
}

function RoseAnim() {
  const p = useProgress(2000);
  const petals = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);
  return (
    <View style={styles.fill}>
      {petals.map((i) => (
        <Animated.Text
          key={i}
          style={[
            styles.petal,
            {
              left: SCREEN_W * (0.08 + i * 0.11),
              opacity: p.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-40, 280] }) },
                { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ["-20deg", "25deg"] }) },
              ],
            },
          ]}
        >
          🌹
        </Animated.Text>
      ))}
    </View>
  );
}

function HeartAnim() {
  const p = useProgress(2000);
  return (
    <View style={styles.center}>
      <Animated.Text
        style={{
          fontSize: 86,
          opacity: p.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            {
              scale: p.interpolate({
                inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                outputRange: [0.4, 1.2, 0.95, 1.15, 1, 0.7],
              }),
            },
          ],
        }}
      >
        💛
      </Animated.Text>
      <Animated.Text
        style={{
          position: "absolute",
          fontSize: 22,
          opacity: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
        }}
      >
        ✨
      </Animated.Text>
    </View>
  );
}

function DiamondAnim() {
  const p = useProgress(2500);
  return (
    <View style={styles.center}>
      <Animated.Text
        style={{
          fontSize: 92,
          opacity: p.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: p.interpolate({ inputRange: [0, 0.35, 1], outputRange: [-220, 8, 0] }) },
            { scale: p.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 1.15, 1] }) },
          ],
        }}
      >
        💎
      </Animated.Text>
    </View>
  );
}

function CrownAnim() {
  const p = useProgress(3000);
  const rain = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  return (
    <View style={styles.fill}>
      <Animated.Text
        style={{
          position: "absolute",
          alignSelf: "center",
          top: "28%",
          fontSize: 88,
          opacity: p.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [-160, 0, 0] }) }],
        }}
      >
        👑
      </Animated.Text>
      {rain.map((i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            left: SCREEN_W * (0.05 + i * 0.075),
            fontSize: 14,
            opacity: p.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [40, 420] }) }],
          }}
        >
          ✨
        </Animated.Text>
      ))}
    </View>
  );
}

function RocketAnim() {
  const p = useProgress(3000);
  return (
    <View style={styles.fill}>
      <Animated.Text
        style={{
          position: "absolute",
          fontSize: 72,
          opacity: p.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-80, 280] }) },
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [260, -40] }) },
            { rotate: "-28deg" },
          ],
        }}
      >
        🚀
      </Animated.Text>
    </View>
  );
}

function LionAnim({ name }: { name: string }) {
  const p = useProgress(4000);
  const bits = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);
  return (
    <View style={styles.fill}>
      <Animated.View
        style={[
          styles.flash,
          { opacity: p.interpolate({ inputRange: [0, 0.08, 0.18, 1], outputRange: [0.7, 0.9, 0, 0] }) },
        ]}
      />
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: p.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ scale: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.8, 1, 1] }) }],
          },
        ]}
      >
        <Text style={styles.bannerTxt}>🦁 {name} a envoyé un LION !</Text>
      </Animated.View>
      {bits.map((i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            left: SCREEN_W * (0.04 + (i % 9) * 0.1),
            fontSize: 16,
            opacity: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [80, 460] }) }],
          }}
        >
          {i % 2 ? "✨" : "💛"}
        </Animated.Text>
      ))}
    </View>
  );
}

function SimpleEmoji({ emoji }: { emoji: string }) {
  const p = useProgress(2000);
  return (
    <View style={styles.center}>
      <Animated.Text
        style={{
          fontSize: 80,
          opacity: p.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ scale: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.1, 1] }) }],
        }}
      >
        {emoji}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 70 },
  fill: { ...StyleSheet.absoluteFill },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  petal: { position: "absolute", top: 40, fontSize: 28 },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: GOLD },
  banner: {
    position: "absolute",
    top: "38%",
    left: 16,
    right: 16,
    backgroundColor: "rgba(12,17,34,0.88)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  bannerTxt: { color: GOLD, fontWeight: "900", fontSize: 16, textAlign: "center" },
});
