import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
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
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  Gavel,
  Gift,
  ImagePlus,
  Plus,
  ShoppingBag,
  Timer,
  Trash2,
  X,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Logo } from "../components/Logo";
import { MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { GlassIconButton } from "../components/Glass";
import { AddProductSheet } from "../components/broadcast/AddProductSheet";
import { ShopPickerSheet } from "../components/broadcast/ShopPickerSheet";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import {
  BROADCAST_CATEGORY_FR,
  BROADCAST_CATEGORY_KEYS,
  type BroadcastCategoryKey,
} from "../lib/broadcast-categories";
import { type LiveDraftProduct } from "../lib/broadcast-products";
import { pickImageFromLibrary, type PickedImage } from "../lib/pick-image";
import { createScheduledLiveInDb, uploadLiveCover } from "../lib/lives";
import { GOLD, GOLD_GO_LIVE } from "../theme";

const GOLD_DIM = "rgba(232,185,59,0.32)";
const CARD_BG = "rgba(22, 28, 52, 0.78)";
const FIELD_BG = "rgba(12, 16, 36, 0.92)";
const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function upcomingDays(count = 30) {
  const today = startOfDay(new Date());
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

function formatDateLabel(d: Date, locale: string) {
  return d.toLocaleDateString(locale.startsWith("en") ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDayChoice(d: Date, locale: string) {
  return d.toLocaleDateString(locale.startsWith("en") ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function ScheduleLiveScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { closeOverlay } = useNav();
  const { user } = useAuth();
  const currency = user?.walletCurrency ?? "EUR";
  const locale = i18n.language || "fr";

  const [title, setTitle] = useState(user?.displayName?.trim() || "");
  const [category, setCategory] = useState<BroadcastCategoryKey>("Fashion");
  const [showCat, setShowCat] = useState(false);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [products, setProducts] = useState<LiveDraftProduct[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<{ h: number; m: number } | null>(null);
  const [duration, setDuration] = useState(45);
  const [description, setDescription] = useState("");
  const [allowBids, setAllowBids] = useState(true);
  const [allowBuyNow, setAllowBuyNow] = useState(true);
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);

  const [pick, setPick] = useState<"date" | "time" | "duration" | null>(null);

  const hasProfileAvatar = Boolean(user?.avatarUrl?.trim());
  const hasCover = Boolean(coverPreview?.trim());
  const coverRequired = !hasProfileAvatar;
  const coverOk = !coverRequired || hasCover;

  const flash = useCallback(
    (msg: string, thenClose = false) => {
      setToast(msg);
      setTimeout(() => {
        setToast(null);
        if (thenClose) closeOverlay();
      }, 1800);
    },
    [closeOverlay],
  );

  const pickCover = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setCover(picked);
    setCoverPreview(picked.preview);
  };

  const addProducts = (rows: LiveDraftProduct[]) => {
    setProducts((prev) => [...prev, ...rows]);
  };

  const scheduledAt = useMemo(() => {
    if (!date || !time) return null;
    const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.h, time.m, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }, [date, time]);

  const canLaunch =
    title.trim().length >= 3 && products.length > 0 && Boolean(scheduledAt) && coverOk;

  const submit = async () => {
    if (!user?.id || busy) return;
    if (!coverOk) {
      flash(t("broadcast.setup.errors.coverRequired"));
      return;
    }
    if (title.trim().length < 3) {
      flash(t("broadcast.setup.errors.titleTooShort"));
      return;
    }
    if (products.length === 0) {
      flash(t("broadcast.setup.readyHelp"));
      return;
    }
    if (!scheduledAt) {
      flash(t("schedule.form.needDatetime"));
      return;
    }
    if (scheduledAt.getTime() < Date.now() + 5 * 60 * 1000) {
      flash(t("schedule.form.tooSoon"));
      return;
    }

    setBusy(true);
    try {
      const coverPath = cover
        ? await uploadLiveCover(user.id, cover)
        : user.avatarUrl?.trim() || null;
      await createScheduledLiveInDb({
        sellerId: user.id,
        title: title.trim(),
        category,
        coverPath,
        scheduledAt: scheduledAt.toISOString(),
        description: description.trim() || null,
        estimatedDurationMin: duration,
        allowBids,
        allowBuyNow,
        notifyFollowers,
        allowGifts,
        currency,
        products: products.map((p) => ({
          name: p.name,
          imagePath: p.imagePath ?? null,
          mode: p.mode,
          price: p.mode === "auction" ? p.startPrice : p.price,
          stock: p.stock,
          shopProductId: p.shopProductId,
          timerSeconds: p.timerSec,
        })),
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
      <LinearGradient
        colors={["#1A2244", "#0C1020", "#05060b"]}
        locations={[0, 0.45, 1]}
        style={styles.bg}
        pointerEvents="none"
      />
      <View style={[styles.top, { paddingTop: insets.top + 2 }]}>
        <GlassIconButton tone="dark" onPress={closeOverlay}>
          <X size={20} color="#fff" />
        </GlassIconButton>
        <View style={styles.logoWrap}>
          <Logo size={52} onDark />
          <View style={styles.logoLine} />
        </View>
        <View style={{ width: 44, height: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 20) + 8,
            gap: 14,
          }}
        >
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{t("schedule.form.title")}</Text>
            <Text style={styles.heroSub}>{t("schedule.form.subtitle")}</Text>
          </View>

          <Card
            step={1}
            title={coverRequired ? t("schedule.form.coverTitleRequired") : t("schedule.form.coverTitle")}
          >
            <Press onPress={() => void pickCover()} style={styles.coverBtn}>
              {coverPreview ? (
                <Image source={{ uri: coverPreview }} style={styles.coverImg} contentFit="cover" />
              ) : (
                <View style={styles.coverEmpty}>
                  <ImagePlus size={32} color="rgba(255,255,255,0.35)" />
                  <View style={styles.coverAdd}>
                    <Plus size={14} color={GOLD} />
                    <Text style={styles.coverAddTxt}>{t("schedule.form.addCover")}</Text>
                  </View>
                </View>
              )}
            </Press>
            {coverRequired && !hasCover ? (
              <Text style={styles.coverHint}>{t("broadcast.setup.errors.coverRequiredHint")}</Text>
            ) : null}
          </Card>

          <Card step={2} title={t("schedule.form.infoTitle")}>
            <View style={{ gap: 10 }}>
              <View style={styles.infoRow}>
                <Text style={styles.sideLbl}>{t("schedule.form.titleLabel")}</Text>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t("broadcast.setup.titlePlaceholder")}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    maxLength={80}
                    style={styles.field}
                  />
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.sideLbl}>{t("schedule.form.categoryLabel")}</Text>
                <Press onPress={() => setShowCat(true)} style={[styles.fieldBtn, { flex: 1 }]}>
                  <Text style={styles.fieldVal}>{BROADCAST_CATEGORY_FR[category]}</Text>
                  <ChevronDown size={16} color="rgba(255,255,255,0.55)" />
                </Press>
              </View>
              <View style={[styles.infoRow, { alignItems: "flex-start" }]}>
                <Text style={[styles.sideLbl, { paddingTop: 10 }]}>{t("schedule.form.descLabel")}</Text>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={description}
                    onChangeText={(v) => setDescription(v.slice(0, 240))}
                    placeholder={t("schedule.form.descPlaceholder")}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline
                    style={[styles.field, styles.area]}
                  />
                </View>
              </View>
            </View>
          </Card>

          <Card step={3} title={t("schedule.form.dateTitle")}>
            <View style={styles.dtRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLbl}>{t("schedule.form.date")}</Text>
                <Press onPress={() => setPick("date")} style={styles.picker}>
                  <Calendar size={16} color={GOLD} />
                  <Text numberOfLines={1} style={[styles.pickerTxt, !date && styles.pickerPh]}>
                    {date ? formatDateLabel(date, locale) : t("schedule.form.pickDate")}
                  </Text>
                </Press>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLbl}>{t("schedule.form.time")}</Text>
                <Press onPress={() => setPick("time")} style={styles.picker}>
                  <Clock size={16} color={GOLD} />
                  <Text style={[styles.pickerTxt, !time && styles.pickerPh]}>
                    {time ? `${pad2(time.h)}:${pad2(time.m)}` : "--:--"}
                  </Text>
                </Press>
              </View>
            </View>
            <Text style={[styles.miniLbl, { marginTop: 12 }]}>{t("schedule.form.duration")}</Text>
            <Press onPress={() => setPick("duration")} style={styles.picker}>
              <Timer size={16} color={GOLD} />
              <Text style={[styles.pickerTxt, { flex: 1 }]}>{duration} min</Text>
              <ChevronsUpDown size={16} color="rgba(255,255,255,0.55)" />
            </Press>
          </Card>

          <Card step={4} title={t("schedule.form.productsTitle")}>
            <View style={{ gap: 8 }}>
              {products.map((p) => (
                <View key={p.id} style={styles.prodRow}>
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={styles.prodThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.prodThumb, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
                  )}
                  <Text numberOfLines={1} style={styles.prodName}>
                    {p.name}
                  </Text>
                  <View style={styles.prodBadge}>
                    <Text style={styles.prodBadgeTxt}>
                      {p.mode === "auction"
                        ? t("broadcast.setup.productSheet.auction")
                        : t("broadcast.setup.productSheet.fixedPrice")}
                    </Text>
                  </View>
                  <Press onPress={() => setProducts((prev) => prev.filter((x) => x.id !== p.id))} style={styles.prodDel}>
                    <Trash2 size={16} color="rgba(255,255,255,0.5)" />
                  </Press>
                </View>
              ))}
              <Press onPress={() => setShowAdd(true)} style={styles.addProduct}>
                <Plus size={16} color={GOLD} />
                <Text style={styles.addProductTxt}>{t("schedule.form.addProduct")}</Text>
              </Press>
            </View>
          </Card>

          <Card step={5} title={t("schedule.form.optionsTitle")}>
            <Opt icon={<Gavel size={18} color={GOLD} />} label={t("schedule.form.optAuctions")} value={allowBids} onValueChange={setAllowBids} />
            <Opt icon={<ShoppingBag size={18} color={GOLD} />} label={t("schedule.form.optBuyNow")} value={allowBuyNow} onValueChange={setAllowBuyNow} />
            <Opt icon={<Bell size={18} color={GOLD} />} label={t("schedule.form.optNotify")} value={notifyFollowers} onValueChange={setNotifyFollowers} />
            <Opt icon={<Gift size={18} color={GOLD} />} label={t("schedule.form.optGifts")} value={allowGifts} onValueChange={setAllowGifts} />
          </Card>

          <Press
            onPress={() => void submit()}
            disabled={busy}
            style={[styles.cta, (!canLaunch || busy) && { opacity: 0.45 }]}
          >
            <LinearGradient colors={[GOLD, GOLD_GO_LIVE, "#C9962C"]} style={styles.ctaGrad}>
              <Calendar size={18} color="#0a0a12" />
              <Text style={styles.ctaTxt}>{busy ? t("common.loading") : t("schedule.form.cta")}</Text>
            </LinearGradient>
          </Press>
          <Text style={styles.hint}>{t("schedule.form.hint")}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <AddProductSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(p) => addProducts([p])}
        onPickFromShop={() => {
          setShowAdd(false);
          setShowShop(true);
        }}
        currency={currency}
      />
      <ShopPickerSheet
        open={showShop}
        onClose={() => setShowShop(false)}
        onConfirm={addProducts}
        userId={user?.id}
        currency={currency}
      />

      <ChoiceSheet open={showCat} title={t("schedule.form.categoryLabel")} onClose={() => setShowCat(false)}>
        {BROADCAST_CATEGORY_KEYS.map((key) => (
          <Press
            key={key}
            onPress={() => {
              setCategory(key);
              setShowCat(false);
            }}
            style={styles.choiceRow}
          >
            <Text style={[styles.choiceTxt, category === key && { color: GOLD }]}>
              {BROADCAST_CATEGORY_FR[key]}
            </Text>
          </Press>
        ))}
      </ChoiceSheet>

      <ChoiceSheet open={pick === "date"} title={t("schedule.form.date")} onClose={() => setPick(null)}>
        {upcomingDays().map((d) => {
          const on = date != null && startOfDay(date).getTime() === d.getTime();
          return (
            <Press
              key={d.toISOString()}
              onPress={() => {
                setDate(d);
                setPick(null);
              }}
              style={styles.choiceRow}
            >
              <Text style={[styles.choiceTxt, on && { color: GOLD }]}>{formatDayChoice(d, locale)}</Text>
            </Press>
          );
        })}
      </ChoiceSheet>

      <TimeSheet
        open={pick === "time"}
        initial={time ?? { h: new Date().getHours() + 1, m: 0 }}
        onClose={() => setPick(null)}
        onPick={(v) => {
          setTime(v);
          if (!date) setDate(startOfDay(new Date()));
          setPick(null);
        }}
      />

      <ChoiceSheet open={pick === "duration"} title={t("schedule.form.duration")} onClose={() => setPick(null)}>
        {DURATION_OPTIONS.map((mins) => (
          <Press
            key={mins}
            onPress={() => {
              setDuration(mins);
              setPick(null);
            }}
            style={styles.choiceRow}
          >
            <Text style={[styles.choiceTxt, duration === mins && { color: GOLD }]}>{mins} min</Text>
          </Press>
        ))}
      </ChoiceSheet>

      <MockBanner text={toast} />
    </View>
  );
}

function Card({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["transparent", GOLD, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardShine}
        pointerEvents="none"
      />
      <View style={styles.cardHead}>
        <LinearGradient colors={[GOLD, "#C9962C"]} style={styles.badge}>
          <Text style={styles.badgeTxt}>{step}</Text>
        </LinearGradient>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Opt({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: ReactNode;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.opt}>
      {icon}
      <Text style={styles.optLbl}>{label}</Text>
      <Press onPress={() => onValueChange(!value)} style={[styles.sw, value && styles.swOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </Press>
    </View>
  );
}

function ChoiceSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBack}>
        <Press haptic="none" onPress={onClose} style={{ flex: 1, minHeight: 0, minWidth: 0 }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 420 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TimeSheet({
  open,
  initial,
  onClose,
  onPick,
}: {
  open: boolean;
  initial: { h: number; m: number };
  onClose: () => void;
  onPick: (v: { h: number; m: number }) => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [h, setH] = useState(initial.h % 24);
  const [m, setM] = useState(initial.m % 60);

  useEffect(() => {
    if (!open) return;
    setH(((initial.h % 24) + 24) % 24);
    setM(((initial.m % 60) + 60) % 60);
  }, [open, initial.h, initial.m]);
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBack}>
        <Press haptic="none" onPress={onClose} style={{ flex: 1, minHeight: 0, minWidth: 0 }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t("schedule.form.time")}</Text>
          <View style={styles.timeCols}>
            <ScrollView style={styles.timeCol} contentContainerStyle={{ paddingVertical: 8 }}>
              {HOURS.map((n) => (
                <Press key={`h-${n}`} onPress={() => setH(n)} style={styles.timeCell}>
                  <Text style={[styles.timeCellTxt, h === n && styles.timeOn]}>{pad2(n)}</Text>
                </Press>
              ))}
            </ScrollView>
            <Text style={styles.timeColon}>:</Text>
            <ScrollView style={styles.timeCol} contentContainerStyle={{ paddingVertical: 8 }}>
              {MINUTES.map((n) => (
                <Press key={`m-${n}`} onPress={() => setM(n)} style={styles.timeCell}>
                  <Text style={[styles.timeCellTxt, m === n && styles.timeOn]}>{pad2(n)}</Text>
                </Press>
              ))}
            </ScrollView>
          </View>
          <Press onPress={() => onPick({ h, m })} style={styles.timeOk}>
            <Text style={styles.timeOkTxt}>{t("common.ok", { defaultValue: "OK" })}</Text>
          </Press>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060b" },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 6,
    zIndex: 50,
  },
  logoWrap: { alignItems: "center" },
  logoLine: {
    marginTop: 2,
    height: 1,
    width: 88,
    backgroundColor: GOLD_DIM,
  },
  hero: { alignItems: "center", paddingTop: 4, paddingBottom: 4 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center" },
  heroSub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 340,
    lineHeight: 18,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    backgroundColor: CARD_BG,
    padding: 14,
    overflow: "hidden",
  },
  cardShine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    opacity: 0.7,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 12 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  coverBtn: {
    height: 160,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: GOLD_DIM,
    minHeight: 160,
    alignItems: "stretch",
  },
  coverImg: { width: "100%", height: "100%" },
  coverEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  coverAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  coverAddTxt: { color: GOLD, fontWeight: "700", fontSize: 13 },
  coverHint: { marginTop: 8, color: "#E07A6A", fontSize: 12, fontWeight: "600" },
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sideLbl: { width: 108, color: "rgba(255,255,255,0.68)", fontSize: 13 },
  fieldLbl: { color: "rgba(255,255,255,0.68)", fontSize: 13, marginTop: 4 },
  field: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 14,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  area: { height: 72, paddingTop: 10, textAlignVertical: "top" },
  fieldBtn: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 42,
  },
  fieldVal: { color: "#fff", fontSize: 14 },
  dtRow: { flexDirection: "row", gap: 10 },
  miniLbl: { color: "rgba(255,255,255,0.68)", fontSize: 13, marginBottom: 6 },
  picker: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
  },
  pickerTxt: { color: "#fff", fontSize: 14, flex: 1 },
  pickerPh: { color: "rgba(255,255,255,0.55)" },
  prodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 8,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  prodThumb: { width: 44, height: 44, borderRadius: 8, overflow: "hidden" },
  prodName: { flex: 1, color: "#fff", fontSize: 13.5, fontWeight: "600" },
  prodBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  prodBadgeTxt: { color: GOLD, fontSize: 10.5, fontWeight: "700" },
  prodDel: { width: 32, height: 32, minWidth: 32, minHeight: 32 },
  addProduct: {
    height: 44,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: GOLD_DIM,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  addProductTxt: { color: GOLD, fontWeight: "700", fontSize: 13.5 },
  opt: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 36, marginBottom: 10 },
  optLbl: { flex: 1, color: "#fff", fontSize: 14 },
  sw: {
    width: 48,
    height: 28,
    minWidth: 48,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  swOn: { backgroundColor: GOLD },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  knobOn: { alignSelf: "flex-end" },
  cta: { minHeight: 56, alignItems: "stretch", marginTop: 4 },
  ctaGrad: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 16 },
  hint: { textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: -6 },
  modalBack: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: "#141A32",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    maxHeight: "70%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 8,
    marginBottom: 8,
  },
  sheetTitle: { color: "#fff", fontWeight: "800", fontSize: 18, marginBottom: 8 },
  choiceRow: { minHeight: 48, alignItems: "flex-start", paddingHorizontal: 4 },
  choiceTxt: { color: "#fff", fontSize: 16, fontWeight: "600", textTransform: "capitalize" },
  timeCols: { flexDirection: "row", alignItems: "center", height: 220, gap: 8 },
  timeCol: { flex: 1 },
  timeColon: { color: "#fff", fontSize: 28, fontWeight: "800" },
  timeCell: { minHeight: 40, height: 40 },
  timeCellTxt: { color: "rgba(255,255,255,0.5)", fontSize: 20, fontWeight: "700" },
  timeOn: { color: GOLD, fontSize: 24 },
  timeOk: { height: 48, borderRadius: 14, backgroundColor: GOLD, marginTop: 8, marginBottom: 8 },
  timeOkTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 16 },
});
