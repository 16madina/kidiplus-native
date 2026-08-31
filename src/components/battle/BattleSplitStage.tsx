import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { battleDockMetrics } from "../../lib/battle-timing";
import { GOLD } from "../../theme";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export type BattleSplitFighter = {
  displayName: string;
  avatarUrl?: string | null;
};

function PaneName({ name }: { name: string }) {
  return (
    <View style={styles.nameWrap} pointerEvents="none">
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)"]}
        style={FILL}
        pointerEvents="none"
      />
      <Text style={styles.nameTxt} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function GuestPlaceholder({
  fighter,
  status,
}: {
  fighter: BattleSplitFighter;
  status?: string;
}) {
  const { t } = useTranslation();
  const initial = (fighter.displayName.trim()[0] ?? "?").toUpperCase();
  const statusTxt =
    status === "reconnecting" || status === "connecting"
      ? t("battle.split.reconnecting")
      : t("battle.split.remotePlaceholder");
  return (
    <View style={[FILL, styles.placeholder]}>
      {fighter.avatarUrl ? (
        <Image source={{ uri: fighter.avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarLetter}>{initial}</Text>
        </View>
      )}
      <Text style={styles.placeholderTxt}>{statusTxt}</Text>
    </View>
  );
}

function SplitDivider() {
  const { t } = useTranslation();
  const words = t("battle.split.vs").split(/\s+/).filter(Boolean);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.dividerWrap} pointerEvents="none">
      <LinearGradient
        colors={["transparent", "#3b82f6", "#93c5fd", "#3b82f6", "transparent"]}
        style={styles.dividerLine}
      />
      <Animated.View style={[styles.vsBadge, { transform: [{ scale: pulse }] }]}>
        {words.map((word) => (
          <Text key={word} style={styles.vsWord}>
            {word}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function BattleSplitStage({
  active,
  hostVideo,
  hostFighter,
  guestVideo = null,
  guestFighter = null,
  guestStatus,
}: {
  active: boolean;
  hostVideo: ReactNode;
  hostFighter?: BattleSplitFighter | null;
  guestVideo?: ReactNode;
  guestFighter?: BattleSplitFighter | null;
  guestStatus?: string;
}) {
  const insets = useSafeAreaInsets();
  const { dockTop, dockHeight } = battleDockMetrics(insets.top, Dimensions.get("window").height);

  if (!active) {
    return <View style={FILL}>{hostVideo}</View>;
  }

  return (
    <View style={FILL} pointerEvents="box-none">
      <View
        style={[
          styles.pane,
          {
            top: dockTop,
            height: dockHeight,
            left: 4,
            right: undefined,
            width: "48.5%",
          },
        ]}
      >
        {hostVideo}
        {hostFighter ? <PaneName name={hostFighter.displayName} /> : null}
      </View>

      <View
        style={[
          styles.pane,
          styles.guestPane,
          {
            top: dockTop,
            height: dockHeight,
            right: 4,
            left: undefined,
            width: "48.5%",
          },
        ]}
      >
        {guestVideo ? (
          guestVideo
        ) : guestFighter ? (
          <GuestPlaceholder fighter={guestFighter} status={guestStatus} />
        ) : (
          <View style={[FILL, styles.placeholder]} />
        )}
        {guestFighter ? <PaneName name={guestFighter.displayName} /> : null}
      </View>

      <View
        style={[styles.dividerBand, { top: dockTop, height: dockHeight }]}
        pointerEvents="none"
      >
        <SplitDivider />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#000",
    zIndex: 12,
  },
  guestPane: {
    backgroundColor: "#0c0c10",
  },
  nameWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 36,
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingBottom: 6,
    zIndex: 10,
  },
  nameTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0c0c10",
    gap: 10,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  placeholderTxt: {
    position: "absolute",
    bottom: 28,
    left: 8,
    right: 8,
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
  },
  dividerBand: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
  },
  dividerWrap: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    shadowColor: "#3b82f6",
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  vsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,236,170,0.55)",
  },
  vsWord: {
    color: "#1a1408",
    fontSize: 8,
    fontWeight: "900",
    lineHeight: 9,
    letterSpacing: 0.2,
  },
});
