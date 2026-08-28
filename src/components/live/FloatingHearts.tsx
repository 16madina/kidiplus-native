import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

const MAX = 15;
const HEARTS = ["❤️", "💛", "🧡", "💗"];

type Burst = { id: number; x: number; emoji: string; anim: Animated.Value };

/** TikTok-style floating hearts. Cap 15 on screen. `pulse` increments spawn one. */
export function FloatingHearts({ pulse }: { pulse: number }) {
  const [items, setItems] = useState<Burst[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (!pulse) return;
    const id = ++nextId.current;
    const anim = new Animated.Value(0);
    const burst: Burst = {
      id,
      x: 8 + Math.random() * 56,
      emoji: HEARTS[id % HEARTS.length],
      anim,
    };
    setItems((prev) => [...prev.slice(-(MAX - 1)), burst]);
    Animated.timing(anim, {
      toValue: 1,
      duration: 1600 + Math.random() * 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setItems((prev) => prev.filter((h) => h.id !== id));
    });
  }, [pulse]);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {items.map((h) => (
        <Animated.View
          key={h.id}
          style={[
            styles.heart,
            {
              right: h.x,
              opacity: h.anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
              transform: [
                {
                  translateY: h.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -180] }),
                },
                {
                  scale: h.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.15, 0.8] }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.emoji}>{h.emoji}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, zIndex: 40 },
  heart: { position: "absolute", bottom: 120 },
  emoji: { fontSize: 22 },
});
