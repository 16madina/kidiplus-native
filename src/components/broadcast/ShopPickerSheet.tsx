import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../Press";
import { listMyShopProducts } from "../../lib/shop";
import {
  AUCTION_TIMER_PRESETS,
  newDraftId,
  type LiveDraftProduct,
  type LiveSaleKind,
} from "../../lib/broadcast-products";
import { currencySymbol } from "../../lib/money";
import { GOLD, NAVY } from "../../theme";
import { type ShopItem } from "../../mock/account";

type ItemConfig = {
  mode: LiveSaleKind;
  amount: string;
  timer: string;
};

function defaultAmount(item: ShopItem, currency: string) {
  if (item.priceValue && item.priceValue > 0) return String(item.priceValue);
  return currency === "XOF" ? "500" : "1";
}

export function ShopPickerSheet({
  open,
  onClose,
  onConfirm,
  userId,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (items: LiveDraftProduct[]) => void;
  userId?: string;
  currency: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const symbol = currencySymbol(currency);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [configs, setConfigs] = useState<Record<string, ItemConfig>>({});

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setConfigs({});
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

  const count = Object.keys(configs).length;

  const select = (item: ShopItem, mode?: LiveSaleKind) => {
    setConfigs((prev) => {
      const existing = prev[item.id];
      if (existing && !mode) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return {
        ...prev,
        [item.id]: {
          mode: mode ?? existing?.mode ?? "auction",
          amount: existing?.amount ?? defaultAmount(item, currency),
          timer: existing?.timer ?? "45",
        },
      };
    });
  };

  const patch = (id: string, part: Partial<ItemConfig>) => {
    setConfigs((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...part } };
    });
  };

  const confirm = () => {
    const drafts = Object.entries(configs).map(([id, c]) => {
      const item = items.find((p) => p.id === id);
      const amount = Math.max(1, Number(c.amount.replace(",", ".")) || 1);
      const timerSec = Math.max(10, Math.floor(Number(c.timer) || 45));
      return {
        id: newDraftId(),
        name: item?.name ?? "Article",
        image: item?.image,
        imagePath: item?.imagePath ?? null,
        shopProductId: id,
        mode: c.mode,
        startPrice: amount,
        price: amount,
        timerSec,
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
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
                  const cfg = configs[item.id];
                  const on = Boolean(cfg);
                  return (
                    <View key={item.id} style={[styles.card, on && styles.cardOn]}>
                      <Press onPress={() => select(item)} style={styles.row}>
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
                      {cfg ? (
                        <View style={styles.sub}>
                          <View style={styles.kindRow}>
                            <Press onPress={() => select(item, "auction")} style={styles.kindBtn}>
                              <View style={[styles.kindInner, cfg.mode === "auction" && styles.kindOn]}>
                                <Text style={[styles.kindTxt, cfg.mode === "auction" && styles.kindTxtOn]}>
                                  {t("shop.auction")}
                                </Text>
                              </View>
                            </Press>
                            <Press onPress={() => select(item, "fixed")} style={styles.kindBtn}>
                              <View style={[styles.kindInner, cfg.mode === "fixed" && styles.kindOn]}>
                                <Text style={[styles.kindTxt, cfg.mode === "fixed" && styles.kindTxtOn]}>
                                  {t("shop.fixed")}
                                </Text>
                              </View>
                            </Press>
                          </View>
                          <View style={styles.two}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.subLbl}>
                                {cfg.mode === "auction"
                                  ? `${t("shop.startPrice")} (${symbol})`
                                  : `${t("shop.price")} (${symbol})`}
                              </Text>
                              <TextInput
                                value={cfg.amount}
                                onChangeText={(amount) =>
                                  patch(item.id, { amount: amount.replace(/[^0-9.,]/g, "") })
                                }
                                keyboardType="decimal-pad"
                                style={styles.amount}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.subLbl}>{t("shop.durationSec")}</Text>
                              <View style={styles.timerField}>
                                <TextInput
                                  value={cfg.timer}
                                  onChangeText={(timer) =>
                                    patch(item.id, { timer: timer.replace(/[^0-9]/g, "") })
                                  }
                                  keyboardType="number-pad"
                                  placeholder="45"
                                  placeholderTextColor="#9AA0B4"
                                  style={styles.timerInput}
                                />
                                <Text style={styles.timerSuffix}>s</Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.timers}>
                            {AUCTION_TIMER_PRESETS.map((p) => {
                              const active = cfg.timer === String(p.sec);
                              return (
                                <Press
                                  key={p.sec}
                                  onPress={() => patch(item.id, { timer: String(p.sec) })}
                                  style={styles.timerBtn}
                                >
                                  <View style={[styles.timerInner, active && styles.timerOn]}>
                                    <Text style={[styles.timerTxt, active && styles.timerTxtOn]}>{p.label}</Text>
                                  </View>
                                </Press>
                              );
                            })}
                          </View>
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
        </KeyboardAvoidingView>
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
  sub: { paddingHorizontal: 10, paddingBottom: 12, gap: 6 },
  kindRow: { flexDirection: "row", gap: 8 },
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
  subLbl: { fontSize: 11, fontWeight: "800", color: "#6B7289", textTransform: "uppercase", marginTop: 4 },
  two: { flexDirection: "row", gap: 8 },
  amount: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F2F3F7",
    paddingHorizontal: 12,
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#E6E8EF",
  },
  timerField: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F2F3F7",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E8EF",
  },
  timerInput: { flex: 1, height: 44, color: NAVY, fontSize: 16, fontWeight: "700" },
  timerSuffix: { fontWeight: "800", color: "#6B7289", fontSize: 13 },
  timers: { flexDirection: "row", gap: 6 },
  timerBtn: { flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" },
  timerInner: {
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F3F7",
  },
  timerOn: { backgroundColor: GOLD },
  timerTxt: { fontWeight: "800", fontSize: 12, color: NAVY },
  timerTxtOn: { color: NAVY },
  cta: { height: 50, borderRadius: 16, backgroundColor: NAVY, marginTop: 8 },
  ctaTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
