import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { User } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { GOLD, NAVY } from "../theme";
import { useAuth } from "../context/auth";
import {
  HOME_CATEGORIES,
  HOME_CATEGORY_LABEL_KEY,
  HOME_CATEGORY_META,
  type HomeCategory,
} from "../mock/home-categories";

const TILE_W = 104;
const TILE_H = 116;

export function CategoryTiles({
  active,
  onChange,
}: {
  active: HomeCategory;
  onChange: (c: HomeCategory) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {HOME_CATEGORIES.map((c) => {
        const meta = HOME_CATEGORY_META[c];
        const isActive = c === active;
        const isPourToi = c === "Pour toi";
        return (
          <Press
            key={c}
            onPress={() => onChange(c)}
            style={[
              styles.tile,
              { outlineColor: isActive ? GOLD : "transparent" } as object,
              isActive ? styles.tileActive : null,
            ]}
          >
            {isPourToi ? (
              user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={styles.pourToi}>
                  <View style={styles.userRing}>
                    <User size={22} color={GOLD} strokeWidth={2} />
                  </View>
                </View>
              )
            ) : meta.image ? (
              <Image source={{ uri: meta.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : null}
            <View style={styles.scrim} />
            <Text style={styles.label}>{t(HOME_CATEGORY_LABEL_KEY[c])}</Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingLeft: 20, paddingRight: 16, gap: 10 },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1C2440",
    minHeight: 0,
    minWidth: 0,
    alignItems: "stretch",
    borderWidth: 2,
    borderColor: "transparent",
  },
  tileActive: { borderColor: GOLD },
  pourToi: {
    ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backgroundColor: "#141B33",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 18,
  },
  userRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: GOLD,
    backgroundColor: "rgba(232,185,59,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backgroundColor: "transparent",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  label: {
    position: "absolute",
    left: 10,
    bottom: 8,
    right: 8,
    color: "#fff",
    fontSize: 12.5,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
