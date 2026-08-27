import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gavel, Plus, Tag } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { listMyShopProducts } from "../lib/shop";
import { GOLD } from "../theme";
import { type ShopItem } from "../mock/account";

export function ShopScreen() {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = user?.id;
    if (!id) {
      setItems([]);
      setLoading(false);
      return;
    }
    void listMyShopProducts(id).then((rows) => {
      if (!cancelled) {
        setItems(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const soon = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("shop.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        <GoldButton label={t("shop.add")} onPress={() => soon(t("shop.addSoon"))} icon={<Plus size={18} color="#151022" />} />
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24 }}>{t("shop.empty")}</Text>
        ) : (
          items.map((item) => (
            <Glass key={item.id} tone={dark ? "dark" : "light"} intensity={32} radius={18} elevated={false}>
              <View style={styles.card}>
                {item.image ? <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" /> : <View style={styles.img} />}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontWeight: "800", color: colors.foreground }}>{item.name}</Text>
                  <Text style={{ color: GOLD, fontWeight: "800" }}>{item.price}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    <View style={styles.pill}>
                      {item.kind === "auction" ? <Gavel size={11} color={GOLD} /> : <Tag size={11} color={GOLD} />}
                      <Text style={styles.pillText}>{item.kind === "auction" ? t("shop.auction") : t("shop.fixed")}</Text>
                    </View>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{t("shop.stock")} {item.stock}</Text>
                    </View>
                  </View>
                </View>
                <Text style={{ fontWeight: "700", fontSize: 12, color: item.active ? GOLD : colors.mutedForeground }}>
                  {item.active ? t("shop.active") : t("shop.archived")}
                </Text>
              </View>
            </Glass>
          ))
        )}
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  card: { flexDirection: "row", gap: 12, padding: 12, alignItems: "center" },
  img: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#E8EAF1" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(232,185,59,0.14)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, fontWeight: "700", color: GOLD },
});
