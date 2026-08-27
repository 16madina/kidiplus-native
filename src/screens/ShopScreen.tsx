import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Gavel, Plus, Tag } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAppTheme } from "../context/theme";
import { GOLD } from "../theme";
import { MOCK_SHOP_ITEMS, type ShopItem } from "../mock/account";

export function ShopScreen() {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [items, setItems] = useState<ShopItem[]>(MOCK_SHOP_ITEMS);
  const [toast, setToast] = useState<string | null>(null);

  const add = () => {
    const n = items.length + 1;
    setItems((prev) => [
      {
        id: `new-${Date.now()}`,
        name: `Nouvel article ${n}`,
        price: "25 €",
        stock: 1,
        kind: "fixed",
        image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=70",
        active: true,
      },
      ...prev,
    ]);
    setToast(t("shop.added"));
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("shop.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        <GoldButton label={t("shop.add")} onPress={add} icon={<Plus size={18} color="#151022" />} />
        {items.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24 }}>{t("shop.empty")}</Text>
        ) : (
          items.map((item) => (
            <Glass key={item.id} tone={dark ? "dark" : "light"} intensity={32} radius={18} elevated={false}>
              <View style={styles.card}>
                <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" />
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
                <Press
                  onPress={() => setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x)))}
                  style={styles.toggle}
                >
                  <Text style={{ fontWeight: "700", fontSize: 12, color: item.active ? GOLD : colors.mutedForeground }}>
                    {item.active ? t("shop.active") : t("shop.archived")}
                  </Text>
                </Press>
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
  toggle: { minHeight: 32, minWidth: 0, paddingHorizontal: 4 },
});
