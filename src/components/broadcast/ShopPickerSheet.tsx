import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../Press";
import { listMyShopProducts } from "../../lib/shop";
import { newDraftId, type LiveDraftProduct, type LiveSaleKind } from "../../lib/broadcast-products";
import { GOLD, NAVY } from "../../theme";
import { type ShopItem } from "../../mock/account";

export function ShopPickerSheet({
  open,
  onClose,
  onConfirm,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (items: LiveDraftProduct[]) => void;
  userId?: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, LiveSaleKind>>({});

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setSelected({});
    setQuery("");
    void listMyShopProducts(userId).then((rows) => {
      if (cancelled) return;
      setItems(rows.filter((r) => r.active && r.stock > 0));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => p.name.toLowerCase().includes(q));
  }, [items, query]);

  const count = Object.keys(selected).length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = "auction";
      return next;
    });
  };

  const confirm = () => {
    const drafts = Object.entries(selected).map(([id, mode]) => {
      const item = items.find((p) => p.id === id);
      const price = item?.priceValue ?? 0;
      return {
        id: newDraftId(),
        name: item?.name ?? "Article",
        image: item?.image,
        imagePath: item?.imagePath ?? null,
        shopProductId: id,
        mode,
        startPrice: price || 1,
        price: price || 1,
        timerSec: 45,
        stock: Math.max(1, item?.stock ?? 1),
      } satisfies LiveDraftProduct;
    });
    onConfirm(drafts);
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Press haptic="none" onPress={onClose} style={styles.dismiss} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>{t("shop.pickTitle")}</Text>
            <Press onPress={onClose} style={styles.close}>
              <X size={22} color={NAVY} />
            </Press>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("shop.searchPlaceholder")}
            placeholderTextColor="#9AA0B4"
            style={styles.search}
          />
          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 12, gap: 8 }}>
              {filtered.length === 0 ? (
                <Text style={styles.empty}>{t("shop.emptyPicker")}</Text>
              ) : (
                filtered.map((item) => {
                  const kind = selected[item.id];
                  const on = Boolean(kind);
                  return (
                    <View key={item.id} style={[styles.card, on && styles.cardOn]}>
                      <Press onPress={() => toggle(item.id)} style={styles.row}>
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
                        ) : (
                          <View style={styles.thumb} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.price}>{item.price}</Text>
                        </View>
                        <View style={[styles.check, on && styles.checkOn]}>
                          {on ? <Check size={14} color="#fff" /> : null}
                        </View>
                      </Press>
                      {on ? (
                        <View style={styles.kindRow}>
                          <Press onPress={() => setSelected((p) => ({ ...p, [item.id]: "auction" }))} style={styles.kindBtn}>
                            <View style={[styles.kindInner, kind === "auction" && styles.kindOn]}>
                              <Text style={[styles.kindTxt, kind === "auction" && styles.kindTxtOn]}>
                                {t("shop.auction")}
                              </Text>
                            </View>
                          </Press>
                          <Press onPress={() => setSelected((p) => ({ ...p, [item.id]: "fixed" }))} style={styles.kindBtn}>
                            <View style={[styles.kindInner, kind === "fixed" && styles.kindOn]}>
                              <Text style={[styles.kindTxt, kind === "fixed" && styles.kindTxtOn]}>
                                {t("shop.fixed")}
                              </Text>
                            </View>
                          </Press>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
          <Press onPress={confirm} disabled={count === 0} style={[styles.cta, count === 0 && { opacity: 0.45 }]}>
            <Text style={styles.ctaTxt}>{t("shop.pickConfirm", { n: count })}</Text>
          </Press>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  dismiss: { flex: 1, minHeight: 0, minWidth: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D8DCE8",
    marginTop: 8,
  },
  head: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: "800", color: NAVY },
  close: { width: 40, height: 40, minWidth: 40, minHeight: 40 },
  search: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F2F3F7",
    paddingHorizontal: 14,
    marginBottom: 10,
    color: NAVY,
  },
  empty: { textAlign: "center", color: "#6B7289", paddingVertical: 24 },
  card: {
    borderWidth: 1,
    borderColor: "#E6E8EF",
    borderRadius: 16,
    overflow: "hidden",
  },
  cardOn: { borderColor: GOLD },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, minHeight: 0 },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#EEE6D6" },
  name: { fontWeight: "800", color: NAVY, fontSize: 14 },
  price: { marginTop: 2, color: GOLD, fontWeight: "700", fontSize: 13 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D0D4E0",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: GOLD, borderColor: GOLD },
  kindRow: { flexDirection: "row", gap: 8, padding: 8, paddingTop: 0 },
  kindBtn: { flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" },
  kindInner: {
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F3F7",
  },
  kindOn: { backgroundColor: NAVY },
  kindTxt: { fontWeight: "800", fontSize: 12, color: NAVY },
  kindTxtOn: { color: "#fff" },
  cta: { height: 50, borderRadius: 16, backgroundColor: NAVY, marginTop: 8 },
  ctaTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
