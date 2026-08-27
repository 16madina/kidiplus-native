import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar, ImagePlus, Radio, Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import {
  BROADCAST_CATEGORY_FR,
  BROADCAST_CATEGORY_KEYS,
  type BroadcastCategoryKey,
} from "../lib/broadcast-categories";
import { pickImageFromLibrary, type PickedImage } from "../lib/pick-image";
import { listMyShopProducts } from "../lib/shop";
import { createScheduledLiveInDb, uploadLiveCover } from "../lib/lives";
import { GOLD, LIVE_RED, NAVY } from "../theme";
import { type ShopItem } from "../mock/account";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

type SaleKind = "auction" | "fixed";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function defaultScheduleParts() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function parseSchedule(date: string, time: string): Date | null {
  const [y, m, day] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  if (!y || !m || !day || Number.isNaN(h) || Number.isNaN(min)) return null;
  const dt = new Date(y, m - 1, day, h, min, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function BroadcastSetupScreen({ mode }: { mode: "now" | "schedule" }) {
  const { t } = useTranslation();
  const { closeOverlay } = useNav();
  const { user } = useAuth();
  const now = mode === "now";
  const initial = defaultScheduleParts();

  const [title, setTitle] = useState(user?.displayName?.trim() || "");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loadingShop, setLoadingShop] = useState(true);
  const [selected, setSelected] = useState<Record<string, SaleKind>>({});
  const [category, setCategory] = useState<BroadcastCategoryKey>("Fashion");
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [scheduleDate, setScheduleDate] = useState(initial.date);
  const [scheduleTime, setScheduleTime] = useState(initial.time);
  const [duration, setDuration] = useState(45);
  const [description, setDescription] = useState("");
  const [allowBids, setAllowBids] = useState(true);
  const [allowBuyNow, setAllowBuyNow] = useState(true);
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);

  const flash = (msg: string, thenClose = false) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
      if (thenClose) closeOverlay();
    }, 1600);
  };

  useEffect(() => {
    const id = user?.id;
    if (!id) {
      setLoadingShop(false);
      return;
    }
    let cancelled = false;
    void listMyShopProducts(id).then((rows) => {
      if (cancelled) return;
      const active = rows.filter((r) => r.active);
      setItems(active);
      setSelected((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const first = active[0];
        return first ? { [first.id]: "auction" } : {};
      });
      setLoadingShop(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);

  const toggleProduct = useCallback((id: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = "auction";
      return next;
    });
  }, []);

  const pickCover = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setCover(picked);
    setCoverPreview(picked.preview);
  };

  const submit = async () => {
    if (!user?.id || busy) return;
    const trimmed = title.trim();
    if (trimmed.length < 3) {
      flash(t("broadcast.setup.errors.titleTooShort", { defaultValue: "Le titre doit contenir au moins 3 caractères" }));
      return;
    }
    if (selectedCount === 0) {
      flash(t("broadcast.setup.readyHelp"));
      return;
    }

    let scheduledAt: Date | undefined;
    if (!now) {
      const dt = parseSchedule(scheduleDate, scheduleTime);
      if (!dt) {
        flash("Date ou heure invalide.");
        return;
      }
      if (dt.getTime() < Date.now() + 5 * 60 * 1000) {
        flash("Programme au moins 5 minutes à l’avance.");
        return;
      }
      scheduledAt = dt;
    }

    if (now) {
      flash("Le studio caméra arrive bientôt. Programme un live, ou lance-le sur kidiplus.com.");
      return;
    }

    setBusy(true);
    try {
      const coverPath = cover ? await uploadLiveCover(user.id, cover) : null;
      const products = Object.entries(selected).map(([id, saleKind]) => {
        const item = items.find((p) => p.id === id);
        return {
          name: item?.name ?? "Article",
          imagePath: item?.imagePath ?? null,
          mode: saleKind,
          price: item?.priceValue ?? 0,
          stock: Math.max(1, item?.stock ?? 1),
          shopProductId: id,
        };
      });
      await createScheduledLiveInDb({
        sellerId: user.id,
        title: trimmed,
        category,
        coverPath,
        scheduledAt: scheduledAt!.toISOString(),
        description: description.trim() || null,
        estimatedDurationMin: duration,
        allowBids,
        allowBuyNow,
        notifyFollowers,
        allowGifts,
        currency: user.walletCurrency,
        products,
      });
      flash(t("schedule.savedToast"), true);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Programmation impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <OverlayHeader
        title={now ? t("golive.entry.startNow") : t("schedule.planningTitle")}
        onDark
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Press onPress={() => void pickCover()} style={{ alignItems: "stretch" }}>
            <View style={styles.preview}>
              {coverPreview ? (
                <Image source={{ uri: coverPreview }} style={FILL} contentFit="cover" />
              ) : (
                <LinearGradient colors={["#0B1436", "#1C2440", "#10162B"]} style={FILL} />
              )}
              <View style={styles.previewScrim} pointerEvents="none" />
              <ImagePlus size={28} color={GOLD} />
              <Text style={styles.previewLabel}>
                {coverPreview ? t("broadcast.setup.changeCover") : t("broadcast.setup.addCover")}
              </Text>
              {now ? (
                <View style={styles.livePill}>
                  <View style={styles.dot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              ) : (
                <Calendar size={16} color={GOLD} />
              )}
            </View>
          </Press>

          <Text style={styles.label}>{t("schedule.form.titleLabel")}</Text>
          <Glass tone="dark" intensity={32} radius={16} elevated={false}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholder={t("broadcast.setup.titlePlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.45)"
            />
          </Glass>

          <Text style={styles.label}>{t("broadcast.setup.category")}</Text>
          <View style={styles.pills}>
            {BROADCAST_CATEGORY_KEYS.map((key) => {
              const on = category === key;
              return (
                <Press key={key} onPress={() => setCategory(key)} style={styles.pillBtn}>
                  <View style={[styles.pill, on && styles.pillOn]}>
                    <Text style={[styles.pillTxt, on && styles.pillTxtOn]}>{BROADCAST_CATEGORY_FR[key]}</Text>
                  </View>
                </Press>
              );
            })}
          </View>

          {!now ? (
            <>
              <Text style={styles.label}>{t("schedule.form.dateTitle")}</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldHint}>{t("schedule.form.date")} (AAAA-MM-JJ)</Text>
                  <Glass tone="dark" intensity={32} radius={16} elevated={false}>
                    <TextInput
                      value={scheduleDate}
                      onChangeText={setScheduleDate}
                      style={styles.input}
                      placeholder="2026-08-27"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      autoCapitalize="none"
                    />
                  </Glass>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldHint}>{t("schedule.form.time")} (HH:MM)</Text>
                  <Glass tone="dark" intensity={32} radius={16} elevated={false}>
                    <TextInput
                      value={scheduleTime}
                      onChangeText={setScheduleTime}
                      style={styles.input}
                      placeholder="20:00"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      autoCapitalize="none"
                    />
                  </Glass>
                </View>
              </View>

              <Text style={styles.label}>{t("schedule.form.duration")}</Text>
              <View style={styles.pills}>
                {DURATION_OPTIONS.map((mins) => {
                  const on = duration === mins;
                  return (
                    <Press key={mins} onPress={() => setDuration(mins)} style={styles.pillBtn}>
                      <View style={[styles.pill, on && styles.pillOn]}>
                        <Text style={[styles.pillTxt, on && styles.pillTxtOn]}>{mins} min</Text>
                      </View>
                    </Press>
                  );
                })}
              </View>

              <Text style={styles.label}>{t("schedule.form.descLabel")}</Text>
              <Glass tone="dark" intensity={32} radius={16} elevated={false}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  style={[styles.input, styles.area]}
                  placeholder={t("broadcast.setup.descriptionPlaceholder")}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  multiline
                />
              </Glass>

              <Toggle
                label={t("schedule.form.optAuctions")}
                value={allowBids}
                onValueChange={setAllowBids}
                icon={<Sparkles size={16} color={GOLD} />}
              />
              <Toggle label={t("schedule.form.optBuyNow")} value={allowBuyNow} onValueChange={setAllowBuyNow} />
              <Toggle label={t("schedule.form.optNotify")} value={notifyFollowers} onValueChange={setNotifyFollowers} />
              <Toggle label={t("schedule.form.optGifts")} value={allowGifts} onValueChange={setAllowGifts} />
            </>
          ) : null}

          <Text style={styles.label}>
            {t("schedule.form.productsTitle")} · {t("shop.pickFromShop")}
          </Text>
          {loadingShop ? (
            <ActivityIndicator color={GOLD} style={{ marginVertical: 16 }} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{t("shop.emptyPicker")}</Text>
          ) : (
            items.map((item) => {
              const kind = selected[item.id];
              const on = Boolean(kind);
              return (
                <View key={item.id} style={{ gap: 6 }}>
                  <Press onPress={() => toggleProduct(item.id)} style={{ alignItems: "stretch" }}>
                    <Glass tone={on ? "gold" : "dark"} intensity={32} radius={16} elevated={false}>
                      <View style={styles.prod}>
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
                        ) : (
                          <View style={styles.thumb} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#fff", fontWeight: "800" }}>{item.name}</Text>
                          <Text style={{ color: GOLD, fontWeight: "700", marginTop: 2 }}>{item.price}</Text>
                        </View>
                        <Text style={{ color: on ? GOLD : "rgba(255,255,255,0.5)", fontWeight: "800" }}>
                          {on ? "✓" : "+"}
                        </Text>
                      </View>
                    </Glass>
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

          <GoldButton
            label={busy ? t("common.loading") : now ? t("golive.entry.startNowShort") : t("schedule.form.cta")}
            icon={
              busy ? undefined : now ? (
                <Radio size={16} color="#151022" />
              ) : (
                <Calendar size={16} color="#151022" />
              )
            }
            onPress={() => void submit()}
            disabled={busy}
          />
          <Text style={styles.footnote}>
            {selectedCount} article{selectedCount > 1 ? "s" : ""} · {BROADCAST_CATEGORY_FR[category]}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <MockBanner text={toast} />
    </View>
  );
}

function Toggle({
  label,
  value,
  onValueChange,
  icon,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <Glass tone={value ? "gold" : "dark"} intensity={32} radius={16} elevated={false}>
      <View style={styles.opt}>
        {icon}
        <Text style={{ flex: 1, color: "#fff", fontWeight: "700" }}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "rgba(255,255,255,0.18)", true: GOLD }}
          thumbColor="#fff"
        />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  preview: {
    height: 180,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B1436",
  },
  previewScrim: { ...FILL, backgroundColor: "rgba(8,12,26,0.28)" },
  previewLabel: { marginTop: 8, color: "#fff", fontWeight: "800" },
  livePill: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: LIVE_RED,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  label: {
    marginTop: 6,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  fieldHint: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  input: { height: 48, color: "#fff", paddingHorizontal: 16, fontSize: 15, fontWeight: "600" },
  area: { height: 88, paddingTop: 12, textAlignVertical: "top" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pillBtn: { minHeight: 0, minWidth: 0 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pillOn: { backgroundColor: GOLD, borderColor: GOLD },
  pillTxt: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 12 },
  pillTxtOn: { color: NAVY },
  row: { flexDirection: "row", gap: 10 },
  empty: { color: "rgba(255,255,255,0.65)", textAlign: "center", marginVertical: 8 },
  prod: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" },
  kindRow: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  kindBtn: { flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" },
  kindInner: {
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  kindOn: { backgroundColor: GOLD },
  kindTxt: { color: "rgba(255,255,255,0.8)", fontWeight: "800", fontSize: 12 },
  kindTxtOn: { color: NAVY },
  opt: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  footnote: { textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
});
