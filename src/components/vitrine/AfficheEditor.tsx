import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInput as TextInputType,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Calendar, ChevronLeft, Clock, ImageIcon, Paintbrush, Pencil, ShoppingBag, Type } from "lucide-react-native";
import { Image } from "expo-image";
import { Press } from "../Press";
import { AfficheCanvas } from "./AfficheCanvas";
import { AffichePoster } from "./AffichePoster";
import { pickImageFromLibrary } from "../../lib/pick-image";
import { uploadVitrineMedia } from "../../lib/vitrine";
import { listMyShopProducts } from "../../lib/shop";
import { formatAfficheWhenParts } from "../../lib/affiche-reminders-logic";
import { useAuth } from "../../context/auth";
import {
  AFFICHE_COLORS,
  AFFICHE_FONTS,
  afficheArticleCount,
  createVitrineAffiche,
  joinAfficheEventAt,
  newAfficheLayout,
  splitAfficheEventAt,
  type AfficheLayout,
  type AfficheLayer,
} from "../../lib/vitrine-affiche";
import { GOLD, NAVY } from "../../theme";
import { isHttpUrl } from "../../lib/storage";
import type { ShopItem } from "../../mock/account";

type ToolId = "photo" | "text" | "article" | "bg";

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AfficheEditor({
  onPublished,
  onClose,
}: {
  onPublished: () => void;
  onClose?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const canvasW = Math.min(width - 28, 400);
  const canvasH = Math.min(height * 0.42, canvasW * 1.15);
  const textRef = useRef<TextInputType>(null);
  const [layout, setLayout] = useState<AfficheLayout>(() =>
    newAfficheLayout({
      sellerName: user?.displayName ?? "",
      shopName: user?.displayName ? `${user.displayName} Boutique` : "",
    }),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolId>("photo");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopLoading, setShopLoading] = useState(false);
  const when = splitAfficheEventAt(layout.eventAt);
  const locale = i18n.language.startsWith("en") ? "en-GB" : "fr-FR";
  const whenParts = formatAfficheWhenParts(layout.eventAt, locale);
  const dateLabel = whenParts?.date ?? when.date;
  const timeLabel = whenParts?.time ?? when.time;

  const selected = useMemo(
    () => layout.layers.find((l) => l.id === selectedId) ?? null,
    [layout.layers, selectedId],
  );

  useEffect(() => {
    if (tool === "text" && selected?.kind === "text") {
      const id = requestAnimationFrame(() => textRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [selected?.id, selected?.kind, tool]);

  const patchLayer = (id: string, patch: Partial<AfficheLayer>) => {
    setLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as AfficheLayer) : l)),
    }));
  };

  const setWhen = (date: string, time: string) => {
    setLayout((prev) => ({ ...prev, eventAt: joinAfficheEventAt(date, time) }));
  };

  const setMainPhoto = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    const url = await uploadVitrineMedia(picked);
    if (!url) {
      Alert.alert("KiDi+", t("vitrine.uploadFail", { defaultValue: "Upload impossible." }));
      return;
    }
    setLayout((prev) => ({ ...prev, backgroundUri: url }));
    setTool("photo");
  };

  const placeText = (x: number, y: number) => {
    const id = nextId();
    setLayout((prev) => ({
      ...prev,
      layers: [
        ...prev.layers,
        {
          id,
          kind: "text",
          text: t("publish.edit.textDefault"),
          x: Math.min(0.92, Math.max(0.08, x)),
          y: Math.min(0.92, Math.max(0.08, y)),
          scale: 1,
          color: "#FFFFFF",
          font: "system",
        },
      ],
    }));
    setSelectedId(id);
    setTool("text");
  };

  const addArticleFromUri = async (uri: string) => {
    const id = nextId();
    setLayout((prev) => ({
      ...prev,
      layers: [...prev.layers, { id, kind: "image", uri, x: 0.78, y: 0.72, scale: 0.85 }],
    }));
    setSelectedId(id);
  };

  const addArticleFromGallery = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    const url = await uploadVitrineMedia(picked);
    if (!url) return;
    await addArticleFromUri(url);
  };

  const openShop = async () => {
    if (!user?.id) {
      Alert.alert("KiDi+", t("publish.affiche.needAccount"));
      return;
    }
    setShopOpen(true);
    setShopLoading(true);
    const rows = await listMyShopProducts(user.id);
    setShopItems(rows.filter((p) => p.active !== false));
    setShopLoading(false);
  };

  const pickArticleSource = () => {
    Alert.alert(t("publish.affiche.pickArticle"), undefined, [
      { text: t("publish.affiche.fromShop"), onPress: () => void openShop() },
      { text: t("publish.fromGallery"), onPress: () => void addArticleFromGallery() },
      { text: t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
    ]);
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true);
    const title =
      layout.title.trim() ||
      layout.layers.find((l) => l.kind === "text")?.text ||
      t("publish.modes.affiche", { defaultValue: "Affiche" });
    const res = await createVitrineAffiche({
      ...layout,
      title,
      shopName: layout.shopName.trim() || (user?.displayName ? `${user.displayName} Boutique` : ""),
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert("KiDi+", res.error);
      return;
    }
    onPublished();
    Alert.alert("KiDi+", t("publish.affichePublished"));
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <View style={styles.head}>
        <Press onPress={onClose} style={styles.headBtn}>
          <ChevronLeft size={24} color="#fff" />
        </Press>
        <Text style={styles.headTitle}>{t("publish.affiche.createTitle")}</Text>
        <Press onPress={() => setPreview(true)} style={styles.headBtn}>
          <Text style={styles.previewTxt}>{t("publish.affiche.preview")}</Text>
        </Press>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        scrollEnabled={!dragging}
      >
        <View style={styles.stageWrap}>
          <View style={[styles.card, { width: canvasW, height: canvasH }]}>
            <AfficheCanvas
              layout={layout}
              width={canvasW}
              height={canvasH}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                const layer = layout.layers.find((l) => l.id === id);
                if (layer?.kind === "text") setTool("text");
              }}
              editable
              onChangeLayer={(id, patch) => patchLayer(id, patch)}
              onDragChange={setDragging}
              onTapEmpty={tool === "text" ? placeText : undefined}
            />
            {!layout.backgroundUri ? (
              <View pointerEvents="none" style={styles.emptyPhoto}>
                <ImageIcon size={28} color="rgba(255,255,255,0.55)" />
                <Text style={styles.emptyTxt}>{t("publish.affiche.addMainPhoto")}</Text>
              </View>
            ) : null}
            <Press onPress={() => void setMainPhoto()} style={styles.pencil}>
              <Pencil size={14} color="#fff" />
            </Press>
          </View>
        </View>

        <View style={styles.tools}>
          <ToolSq
            icon={<ImageIcon size={20} color={tool === "photo" ? NAVY : "#fff"} />}
            label={t("publish.affiche.toolPhoto")}
            on={tool === "photo"}
            onPress={() => {
              setTool("photo");
              void setMainPhoto();
            }}
          />
          <ToolSq
            icon={<Type size={20} color={tool === "text" ? NAVY : "#fff"} />}
            label={t("publish.affiche.toolText")}
            on={tool === "text"}
            onPress={() => setTool("text")}
          />
          <ToolSq
            icon={<ShoppingBag size={20} color={tool === "article" ? NAVY : "#fff"} />}
            label={t("publish.affiche.toolArticle")}
            on={tool === "article"}
            onPress={() => {
              setTool("article");
              pickArticleSource();
            }}
          />
          <ToolSq
            icon={<Paintbrush size={20} color={tool === "bg" ? NAVY : "#fff"} />}
            label={t("publish.affiche.toolBg")}
            on={tool === "bg"}
            onPress={() => setTool("bg")}
          />
        </View>

        {tool === "text" ? (
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>{t("publish.affiche.textMenu")}</Text>
            <Text style={styles.hint}>{t("publish.affiche.tapToType")}</Text>
            {selected?.kind === "text" ? (
              <TextInput
                ref={textRef}
                autoFocus
                value={selected.text}
                onChangeText={(text) => {
                  patchLayer(selected.id, { text });
                  if (!layout.title.trim()) setLayout((prev) => ({ ...prev, title: text }));
                }}
                placeholder={t("publish.edit.textPlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={styles.input}
              />
            ) : null}
            <Text style={styles.section}>{t("publish.affiche.font")}</Text>
            <View style={styles.row}>
              {AFFICHE_FONTS.map((font) => (
                <Press
                  key={font}
                  onPress={() => selected?.kind === "text" && patchLayer(selected.id, { font })}
                  style={[styles.chip, selected?.kind === "text" && selected.font === font && styles.chipOn]}
                >
                  <Text style={styles.chipTxt}>{font}</Text>
                </Press>
              ))}
            </View>
            <Text style={styles.section}>{t("publish.affiche.color")}</Text>
            <View style={styles.row}>
              {AFFICHE_COLORS.map((color) => (
                <Press
                  key={color}
                  onPress={() => selected?.kind === "text" && patchLayer(selected.id, { color })}
                  style={[styles.swatch, { backgroundColor: color }]}
                />
              ))}
            </View>
            {selected?.kind === "text" ? (
              <View style={styles.row}>
                <Press
                  onPress={() => patchLayer(selected.id, { scale: Math.min(4, selected.scale + 0.15) })}
                  style={styles.chip}
                >
                  <Text style={styles.chipTxt}>{t("publish.affiche.bigger")}</Text>
                </Press>
                <Press
                  onPress={() => patchLayer(selected.id, { scale: Math.max(0.5, selected.scale - 0.15) })}
                  style={styles.chip}
                >
                  <Text style={styles.chipTxt}>{t("publish.affiche.smaller")}</Text>
                </Press>
                <Press
                  onPress={() => {
                    setLayout((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== selected.id) }));
                    setSelectedId(null);
                  }}
                  style={styles.chip}
                >
                  <Text style={styles.chipTxt}>{t("common.delete")}</Text>
                </Press>
              </View>
            ) : null}
          </View>
        ) : null}

        {tool === "bg" ? (
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>{t("publish.affiche.toolBg")}</Text>
            <View style={styles.row}>
              {AFFICHE_COLORS.map((color) => (
                <Press
                  key={color}
                  onPress={() => setLayout((prev) => ({ ...prev, backgroundColor: color }))}
                  style={[styles.swatch, { backgroundColor: color }]}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.whenTitle}>{t("publish.affiche.liveTitle")}</Text>
        <TextInput
          value={layout.title}
          onChangeText={(title) => setLayout((prev) => ({ ...prev, title }))}
          placeholder={t("publish.affiche.titlePlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.input}
        />
        <Text style={styles.whenTitle}>{t("publish.affiche.category")}</Text>
        <TextInput
          value={layout.category}
          onChangeText={(category) => setLayout((prev) => ({ ...prev, category }))}
          placeholder={t("publish.affiche.categoryPlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.input}
        />

        <Text style={styles.whenTitle}>{t("publish.affiche.whenLive")}</Text>
        <View style={styles.whenRow}>
          <View style={styles.whenBox}>
            <Calendar size={16} color={GOLD} />
            <TextInput
              value={when.date}
              onChangeText={(date) => setWhen(date, when.time)}
              placeholder={dateLabel}
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.whenInput}
            />
          </View>
          <View style={styles.whenBox}>
            <Clock size={16} color={GOLD} />
            <TextInput
              value={when.time}
              onChangeText={(time) => setWhen(when.date, time)}
              placeholder={timeLabel}
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.whenInput}
            />
          </View>
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLbl}>{t("publish.affiche.remindSubs")}</Text>
          <Switch
            value={layout.remindFollowers}
            onValueChange={(remindFollowers) => setLayout((prev) => ({ ...prev, remindFollowers }))}
            trackColor={{ false: "#2a2a2a", true: GOLD }}
            thumbColor="#fff"
          />
        </View>

        <Press onPress={() => void publish()} disabled={busy} style={[styles.cta, { opacity: busy ? 0.5 : 1 }]}>
          {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.ctaTxt}>{t("publish.affiche.publish")}</Text>}
        </Press>
      </ScrollView>

      <Modal visible={preview} animationType="fade" onRequestClose={() => setPreview(false)}>
        <View style={styles.previewRoot}>
          <AffichePoster
            preview
            affiche={{
              id: "preview",
              userId: user?.id ?? null,
              title: layout.title,
              layout,
              sellerName: user?.displayName || t("publish.affiche.namePlaceholder"),
              shopName: layout.shopName || (user?.displayName ? `${user.displayName} Boutique` : ""),
              handle: user?.handle ?? "",
              avatarUrl: user?.avatarUrl ?? null,
              category: layout.category,
              articleCount: afficheArticleCount(layout),
              createdAt: new Date().toISOString(),
            }}
          />
          <Press onPress={() => setPreview(false)} style={styles.previewClose}>
            <Text style={styles.previewTxt}>{t("common.close", { defaultValue: "Fermer" })}</Text>
          </Press>
        </View>
      </Modal>

      <Modal visible={shopOpen} animationType="slide" onRequestClose={() => setShopOpen(false)}>
        <View style={[styles.shopRoot, { paddingTop: 56 }]}>
          <View style={styles.shopHead}>
            <Text style={styles.headTitle}>{t("publish.affiche.fromShop")}</Text>
            <Press onPress={() => setShopOpen(false)}>
              <Text style={styles.previewTxt}>{t("common.close", { defaultValue: "Fermer" })}</Text>
            </Press>
          </View>
          {shopLoading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
          ) : shopItems.length === 0 ? (
            <Text style={styles.hint}>{t("publish.affiche.noShopItems")}</Text>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {shopItems.map((item) => (
                <Press
                  key={item.id}
                  onPress={() => {
                    if (isHttpUrl(item.image)) void addArticleFromUri(item.image);
                    setShopOpen(false);
                  }}
                  style={styles.shopRow}
                >
                  {isHttpUrl(item.image) ? (
                    <Image source={{ uri: item.image }} style={styles.shopImg} />
                  ) : (
                    <View style={[styles.shopImg, { backgroundColor: "#222" }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopName}>{item.name}</Text>
                    <Text style={styles.shopPrice}>{item.price}</Text>
                  </View>
                </Press>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function ToolSq({
  icon,
  label,
  on,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} style={[styles.tool, on && styles.toolOn]}>
      {icon}
      <Text style={[styles.toolTxt, on && styles.toolTxtOn]}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    height: 48,
  },
  headBtn: { minWidth: 72, minHeight: 40, paddingHorizontal: 8 },
  headTitle: { color: "#fff", fontWeight: "800", fontSize: 17 },
  previewTxt: { color: GOLD, fontWeight: "800" },
  page: { paddingHorizontal: 14, paddingBottom: 36, gap: 14 },
  stageWrap: { alignItems: "center" },
  card: { borderRadius: 22, overflow: "hidden", backgroundColor: "#111" },
  emptyPhoto: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTxt: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
  pencil: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    zIndex: 4,
  },
  whenChip: {
    position: "absolute",
    left: 16,
    bottom: 16,
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  whenChipTxt: { color: GOLD, fontWeight: "800", fontSize: 11, letterSpacing: 0.3 },
  tools: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  tool: {
    flex: 1,
    height: 72,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: GOLD,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toolOn: { backgroundColor: GOLD },
  toolTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  toolTxtOn: { color: NAVY },
  menu: {
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(232,185,59,0.35)",
  },
  menuTitle: { color: "#fff", fontWeight: "800" },
  hint: { color: "rgba(255,255,255,0.55)", fontWeight: "600", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    minHeight: 44,
  },
  section: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: GOLD, borderColor: GOLD },
  chipTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  whenTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  whenRow: { flexDirection: "row", gap: 10 },
  whenBox: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#1a1a1a",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  whenInput: { flex: 1, color: "#fff", fontWeight: "700", minHeight: 44 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLbl: { color: "#fff", fontWeight: "700" },
  cta: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTxt: { color: NAVY, fontWeight: "900", fontSize: 16 },
  previewRoot: { flex: 1, backgroundColor: "#000" },
  previewClose: { position: "absolute", top: 54, right: 16, zIndex: 8 },
  shopRoot: { flex: 1, backgroundColor: "#05060a" },
  shopHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 48,
  },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#141414",
    borderRadius: 14,
    padding: 10,
  },
  shopImg: { width: 56, height: 56, borderRadius: 10 },
  shopName: { color: "#fff", fontWeight: "800" },
  shopPrice: { color: GOLD, fontWeight: "700", marginTop: 2 },
});
