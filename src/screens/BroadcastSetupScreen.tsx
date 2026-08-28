import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
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
  Camera,
  Plus,
  RefreshCw,
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
import { SetupCamera } from "../components/broadcast/SetupCamera";
import { FiltersCarousel } from "../components/broadcast/FiltersCarousel";
import { ScheduleLiveScreen } from "./ScheduleLiveScreen";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useFilter } from "../lib/filters/filter-context";
import {
  BROADCAST_CATEGORY_FR,
  BROADCAST_CATEGORY_KEYS,
  type BroadcastCategoryKey,
} from "../lib/broadcast-categories";
import { type LiveDraftProduct } from "../lib/broadcast-products";
import { pickImageFromLibrary, type PickedImage } from "../lib/pick-image";
import { makeRoomName } from "../lib/livekit";
import { createLiveInDb, uploadLiveCover, uploadLiveProductImage } from "../lib/lives";
import { formatMoney } from "../lib/money";
import { GOLD, GOLD_GO_LIVE, NAVY } from "../theme";
import type { CameraType } from "expo-camera";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
const GOLD_SOFT = "rgba(232,185,59,0.38)";
const PINK = "#FE2C55";
const WEB = "https://kidiplus.com";

export function BroadcastSetupScreen({ mode }: { mode: "now" | "schedule" }) {
  if (mode === "schedule") return <ScheduleLiveScreen />;
  return <GoLiveSetup />;
}

function GoLiveSetup() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { closeOverlay, openOverlay } = useNav();
  const { user } = useAuth();
  const { tint } = useFilter();
  const currency = user?.walletCurrency ?? "EUR";

  const [title, setTitle] = useState(user?.displayName?.trim() ? `${user.displayName} 💎 KiDi+` : "");
  const [category, setCategory] = useState<BroadcastCategoryKey>("Fashion");
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [products, setProducts] = useState<LiveDraftProduct[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTiktok, setShowTiktok] = useState(false);
  const [rtmp, setRtmp] = useState(false);
  const [facing, setFacing] = useState<CameraType>("front");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string, thenClose = false) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
      if (thenClose) closeOverlay();
    }, 1800);
  }, [closeOverlay]);

  const openWeb = () => {
    void Linking.openURL(WEB);
    flash(t("broadcast.tiktok.studioSoon"));
  };

  const pickCover = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setCover(picked);
    setCoverPreview(picked.preview);
  };

  const addProducts = (rows: LiveDraftProduct[]) => {
    setProducts((prev) => [...prev, ...rows]);
  };

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const canLaunch = title.trim().length >= 3 && products.length > 0;

  const submit = async () => {
    if (!user?.id || busy) return;
    if (title.trim().length < 3) {
      flash(t("broadcast.setup.errors.titleTooShort"));
      return;
    }
    if (products.length === 0) {
      flash(t("broadcast.setup.readyHelp"));
      return;
    }
    setBusy(true);
    try {
      const roomName = makeRoomName(user.id);
      const coverPath = cover
        ? await uploadLiveCover(user.id, cover)
        : user.avatarUrl?.trim() || null;
      const liveProducts = [];
      for (const p of products) {
        let imagePath = p.imagePath ?? null;
        if (!imagePath && p.picked) {
          imagePath = await uploadLiveProductImage(user.id, p.picked);
        }
        liveProducts.push({
          name: p.name,
          imagePath,
          mode: p.mode,
          price: p.mode === "auction" ? p.startPrice : p.price,
          stock: p.stock,
          shopProductId: p.shopProductId,
          timerSeconds: p.timerSec,
        });
      }
      const liveId = await createLiveInDb({
        sellerId: user.id,
        title: title.trim(),
        category,
        coverPath,
        roomName,
        currency,
        products: liveProducts,
      });
      // Laisse expo-camera relâcher le capteur avant que LiveKit le prenne.
      await new Promise((r) => setTimeout(r, 600));
      openOverlay({
        kind: "broadcast-live",
        liveId,
        roomName,
        title: title.trim(),
        identity: user.id,
        displayName: user.displayName?.trim() || "Vendeur",
        facing,
      });
    } catch (e) {
      flash(e instanceof Error ? e.message : "Impossible de lancer le live.");
    } finally {
      setBusy(false);
    }
  };

  const primaryCats = useMemo(() => BROADCAST_CATEGORY_KEYS.slice(0, 4), []);

  return (
    <View style={styles.root}>
      {rtmp ? (
        <View style={FILL}>
          <LinearGradient colors={["#0B1436", "#05060a"]} style={FILL} />
          <View style={styles.rtmpPreview}>
            <Text style={styles.rtmpTitle}>{t("broadcast.rtmp.previewTitle")}</Text>
            <Text style={styles.rtmpBody}>{t("broadcast.rtmp.previewBody")}</Text>
          </View>
        </View>
      ) : (
        <SetupCamera facing={facing} tint={tint} />
      )}
      {!showFilters ? <LinearGradient colors={["rgba(5,6,12,0.15)", "rgba(5,6,12,0.55)"]} style={FILL} pointerEvents="none" /> : null}

      <View style={[styles.top, { paddingTop: insets.top + 4, zIndex: 50 }]}>
        <GlassIconButton
          tone="dark"
          onPress={() => {
            if (showFilters) setShowFilters(false);
            else closeOverlay();
          }}
        >
          <X size={20} color="#fff" />
        </GlassIconButton>
        <Logo size={34} onDark />
        <GlassIconButton tone="dark" onPress={() => setFacing((v) => (v === "front" ? "back" : "front"))}>
          <RefreshCw size={18} color="#fff" />
        </GlassIconButton>
      </View>

      {!showFilters ? (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.drag} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.identity}>
              <View style={{ alignItems: "center", width: 86 }}>
                <Press onPress={() => void pickCover()} style={styles.avatarBtn}>
                  <View style={styles.avatarRing}>
                    {coverPreview ? (
                      <Image source={{ uri: coverPreview }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <Camera size={22} color={GOLD} />
                    )}
                  </View>
                </Press>
                <View style={styles.editRow}>
                  <Press onPress={() => void pickCover()} style={styles.editChip}>
                    <Camera size={11} color="#0a0a12" />
                    <Text style={styles.editChipTxt}>{t("common.edit")}</Text>
                  </Press>
                  <Press onPress={() => setShowFilters(true)} style={styles.filterChip}>
                    <Text style={styles.filterChipTxt}>{t("broadcast.setup.filterBtn", { defaultValue: "Filtre" })}</Text>
                  </Press>
                </View>
              </View>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t("broadcast.setup.titlePlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.45)"
                maxLength={80}
                style={styles.titleBox}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
              {primaryCats.map((key) => {
                const on = category === key;
                return (
                  <Press key={key} onPress={() => setCategory(key)} style={styles.pillBtn}>
                    <View style={[styles.pill, on && styles.pillOn]}>
                      <Text style={[styles.pillTxt, on && styles.pillTxtOn]}>{BROADCAST_CATEGORY_FR[key]}</Text>
                    </View>
                  </Press>
                );
              })}
              {BROADCAST_CATEGORY_KEYS.slice(4).map((key) => {
                const on = category === key;
                return (
                  <Press key={key} onPress={() => setCategory(key)} style={styles.pillBtn}>
                    <View style={[styles.pill, on && styles.pillOn]}>
                      <Text style={[styles.pillTxt, on && styles.pillTxtOn]}>{BROADCAST_CATEGORY_FR[key]}</Text>
                    </View>
                  </Press>
                );
              })}
            </ScrollView>

            <SocialCard
              title={t("broadcast.youtube.connectTitle")}
              hint={t("broadcast.youtube.connectHint")}
              action={t("broadcast.youtube.connect")}
              onPress={openWeb}
            />
            <SocialCard
              title={t("broadcast.facebook.connectTitle")}
              hint={t("broadcast.facebook.connectHint")}
              action={t("broadcast.facebook.connect")}
              onPress={openWeb}
            />
            <View style={[styles.social, { borderColor: "rgba(254,44,85,0.45)" }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.socialTitle}>{t("broadcast.tiktok.connectTitle")}</Text>
                <Text style={styles.socialHint} numberOfLines={2}>
                  {t("broadcast.tiktok.connectHint")}
                </Text>
              </View>
              <Press onPress={() => setShowTiktok(true)} style={styles.tiktokBtn}>
                <Text style={styles.tiktokBtnTxt}>{t("broadcast.tiktok.howTo")}</Text>
              </Press>
            </View>

            <Press onPress={() => setRtmp((v) => !v)} style={[styles.social, rtmp && { borderColor: GOLD }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.socialTitle}>{t("broadcast.rtmp.toggleTitle")}</Text>
                <Text style={styles.socialHint} numberOfLines={2}>
                  {t("broadcast.rtmp.toggleHint")}
                </Text>
              </View>
              <View style={[styles.rtmpBadge, rtmp && styles.rtmpOn]}>
                <Text style={[styles.rtmpTxt, rtmp && { color: "#0a0a12" }]}>
                  {rtmp ? t("broadcast.rtmp.on") : t("broadcast.rtmp.off")}
                </Text>
              </View>
            </Press>

            <Text style={styles.prodTitle}>
              {t("broadcast.setup.products")} ({products.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {products.map((p) => (
                <View key={p.id} style={styles.prodCard}>
                  <View style={styles.prodThumb}>
                    {p.image ? (
                      <Image source={{ uri: p.image }} style={FILL} contentFit="cover" />
                    ) : (
                      <View style={[FILL, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
                    )}
                    <Press onPress={() => removeProduct(p.id)} style={styles.prodDel}>
                      <Trash2 size={11} color="#fff" />
                    </Press>
                  </View>
                  <Text numberOfLines={1} style={styles.prodName}>
                    {p.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.prodPrice}>
                    {p.mode === "auction"
                      ? `dès ${formatMoney(p.startPrice, currency)}`
                      : formatMoney(p.price, currency)}
                  </Text>
                </View>
              ))}
              <Press onPress={() => setShowAdd(true)} style={styles.addTile}>
                <Plus size={22} color={GOLD} />
                <Text style={styles.addTileTxt}>{t("common.add")}</Text>
              </Press>
              <Press onPress={() => setShowShop(true)} style={styles.shopTile}>
                <Text style={{ fontSize: 22 }}>📦</Text>
                <Text style={styles.shopTileTxt}>{t("shop.short")}</Text>
              </Press>
            </ScrollView>

            <Press
              onPress={() => void submit()}
              disabled={busy}
              style={[styles.launch, (!canLaunch || busy) && { opacity: 0.55 }]}
            >
              <LinearGradient colors={[GOLD, GOLD_GO_LIVE, "#C9962C"]} style={styles.launchGrad}>
                <Text style={styles.launchTxt}>
                  {busy ? t("common.loading") : t("broadcast.setup.start")}
                </Text>
              </LinearGradient>
            </Press>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      ) : (
        <FiltersCarousel
          open={showFilters}
          onClose={() => setShowFilters(false)}
          doneLabel={t("broadcast.setup.filtersDone")}
          hint={t("broadcast.setup.filtersHint")}
        />
      )}

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
      <TiktokGuide open={showTiktok} onClose={() => setShowTiktok(false)} />
      <MockBanner text={toast} />
    </View>
  );
}

function SocialCard({
  title,
  hint,
  action,
  onPress,
}: {
  title: string;
  hint: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.social}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={styles.socialTitle}>{title}</Text>
        <Text style={styles.socialHint} numberOfLines={2}>
          {hint}
        </Text>
      </View>
      <Press onPress={onPress} style={styles.connectBtn}>
        <Text style={styles.connectTxt}>{action}</Text>
      </Press>
    </View>
  );
}

function TiktokGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBack}>
        <Press haptic="none" onPress={onClose} style={{ flex: 1 }} />
        <View style={styles.lightSheet}>
          <Text style={styles.lightTitle}>{t("broadcast.tiktok.guideTitle")}</Text>
          <Text style={styles.guideIntro}>{t("broadcast.tiktok.guideIntro")}</Text>
          {[1, 2, 3, 4, 5].map((n) => (
            <Text key={n} style={styles.guideStep}>
              {n}. {t(`broadcast.tiktok.guideStep${n}` as never)}
            </Text>
          ))}
          <Press onPress={onClose} style={styles.tiktokGotIt}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>{t("broadcast.tiktok.guideGotIt")}</Text>
          </Press>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060a" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    zIndex: 50,
  },
  sheet: {
    marginTop: "auto",
    maxHeight: "78%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: GOLD_SOFT,
    backgroundColor: "rgba(12,14,24,0.96)",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  drag: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: GOLD_SOFT,
    marginBottom: 10,
  },
  identity: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatarBtn: { minHeight: 0, minWidth: 0 },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: GOLD,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,22,43,0.9)",
  },
  avatar: { width: "100%", height: "100%" },
  editRow: { flexDirection: "row", gap: 4, marginTop: 6 },
  editChip: {
    minHeight: 26,
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 8,
    backgroundColor: GOLD,
    flexDirection: "row",
    gap: 4,
  },
  editChipTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 11, textTransform: "capitalize" },
  filterChip: {
    minHeight: 26,
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    backgroundColor: "rgba(16,22,43,0.85)",
  },
  filterChipTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  titleBox: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    backgroundColor: "rgba(22,26,48,0.75)",
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 14,
  },
  pills: { gap: 8, paddingRight: 8 },
  pillBtn: { minHeight: 0, minWidth: 0 },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  pillOn: { backgroundColor: GOLD, borderColor: GOLD },
  pillTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  pillTxtOn: { color: "#0a0a12" },
  social: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(16,20,40,0.7)",
  },
  socialTitle: { color: "#fff", fontWeight: "800", fontSize: 14 },
  socialHint: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 },
  connectBtn: {
    minHeight: 32,
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: GOLD,
  },
  connectTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 11 },
  tiktokBtn: {
    minHeight: 32,
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: PINK,
  },
  tiktokBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  rtmpBadge: {
    minHeight: 28,
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  rtmpOn: { backgroundColor: GOLD },
  rtmpTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  prodTitle: { color: "#fff", fontWeight: "800", fontSize: 14 },
  prodCard: { width: 80 },
  prodThumb: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: GOLD_SOFT,
  },
  prodDel: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    minWidth: 22,
    minHeight: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  prodName: { marginTop: 4, color: "#fff", fontSize: 10, fontWeight: "700" },
  prodPrice: { color: "rgba(255,255,255,0.6)", fontSize: 9 },
  addTile: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
    minWidth: 80,
  },
  addTileTxt: { color: GOLD, fontSize: 10, fontWeight: "800", marginTop: 2 },
  shopTile: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: GOLD_SOFT,
    backgroundColor: "rgba(22,26,48,0.7)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
    minWidth: 80,
  },
  shopTileTxt: { color: "#fff", fontSize: 10, fontWeight: "800", marginTop: 2 },
  launch: { minHeight: 52, alignItems: "stretch" },
  launchGrad: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  launchTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 16 },
  row: { flexDirection: "row", gap: 10 },
  miniLbl: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  miniInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    color: "#fff",
    paddingHorizontal: 12,
    backgroundColor: "rgba(16,20,40,0.7)",
  },
  opt: { flexDirection: "row", alignItems: "center", gap: 8 },
  optLbl: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 13 },
  modalBack: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  lightSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
  },
  lightTitle: { fontSize: 20, fontWeight: "800", color: NAVY },
  rtmpPreview: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  rtmpTitle: { color: "#fff", fontWeight: "800", fontSize: 17, textAlign: "center" },
  rtmpBody: { marginTop: 8, color: "rgba(255,255,255,0.75)", fontSize: 13, textAlign: "center", lineHeight: 18 },
  filterBar: {
    marginTop: "auto",
    paddingHorizontal: 12,
    paddingTop: 48,
    overflow: "hidden",
  },
  filterHint: { color: "rgba(255,255,255,0.85)", textAlign: "center", fontWeight: "700", fontSize: 12, marginBottom: 10 },
  filterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 10 },
  filterTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  filterDone: { minHeight: 32, height: 32, borderRadius: 999, paddingHorizontal: 12, backgroundColor: GOLD },
  filterDoneTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 12 },
  filterRow: { gap: 12, paddingHorizontal: 4, paddingBottom: 8 },
  filterPick: { minHeight: 0, minWidth: 0, alignItems: "center" },
  filterSwatch: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" },
  filterSwatchOn: { borderColor: GOLD, borderWidth: 3 },
  filterName: { marginTop: 6, color: "#fff", fontWeight: "700", fontSize: 11 },
  guideIntro: { marginTop: 8, color: "#6B7289", fontSize: 13, lineHeight: 18 },
  guideStep: { marginTop: 8, color: NAVY, fontSize: 14, lineHeight: 20 },
  tiktokGotIt: { marginTop: 16, height: 48, borderRadius: 999, backgroundColor: PINK },
});
