import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ImagePlus, Trash2, Type } from "lucide-react-native";
import { Press } from "../Press";
import { AfficheCanvas } from "./AfficheCanvas";
import { AfficheSoonOverlay } from "./AfficheSoonOverlay";
import { pickImageFromLibrary } from "../../lib/pick-image";
import { uploadVitrineMedia } from "../../lib/vitrine";
import { useAuth } from "../../context/auth";
import {
  AFFICHE_COLORS,
  AFFICHE_FONTS,
  createVitrineAffiche,
  newAfficheLayout,
  type AfficheLayout,
  type AfficheLayer,
  type AfficheSoonField,
} from "../../lib/vitrine-affiche";
import { GOLD, NAVY } from "../../theme";

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AfficheEditor({ onPublished }: { onPublished: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const canvasW = Math.min(width - 24, 400);
  const canvasH = Math.min(height * 0.58, canvasW * (16 / 9));
  const [layout, setLayout] = useState<AfficheLayout>(() =>
    newAfficheLayout({
      sellerName: user?.displayName ?? "",
      shopName: user?.handle ? `@${user.handle.replace(/^@/, "")}` : "",
    }),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focused, setFocused] = useState<AfficheSoonField | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => layout.layers.find((l) => l.id === selectedId) ?? null,
    [layout.layers, selectedId],
  );

  const patchLayer = (id: string, patch: Partial<AfficheLayer>) => {
    setLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as AfficheLayer) : l)),
    }));
  };

  const addText = () => {
    const id = nextId();
    setLayout((prev) => ({
      ...prev,
      layers: [
        ...prev.layers,
        {
          id,
          kind: "text",
          text: t("publish.edit.textDefault"),
          x: 0.5,
          y: 0.38,
          scale: 1,
          color: "#FFFFFF",
          font: "system",
        },
      ],
    }));
    setFocused(null);
    setSelectedId(id);
  };

  const addPhoto = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    const url = await uploadVitrineMedia(picked);
    if (!url) {
      Alert.alert("KiDi+", t("vitrine.uploadFail", { defaultValue: "Upload impossible." }));
      return;
    }
    const id = nextId();
    setLayout((prev) => ({
      ...prev,
      layers: [...prev.layers, { id, kind: "image", uri: url, x: 0.5, y: 0.42, scale: 1 }],
    }));
    setFocused(null);
    setSelectedId(id);
  };

  const setBackground = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    const url = await uploadVitrineMedia(picked);
    if (!url) return;
    setLayout((prev) => ({ ...prev, backgroundUri: url }));
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true);
    const title =
      layout.title.trim() ||
      layout.layers.find((l) => l.kind === "text")?.text ||
      t("publish.modes.affiche", { defaultValue: "Affiche" });
    const res = await createVitrineAffiche({ ...layout, title });
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
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        scrollEnabled={!dragging}
      >
        <Text style={styles.hint}>{t("publish.afficheHint")}</Text>
        <View style={styles.stageWrap}>
          <View style={{ width: canvasW, height: canvasH, borderRadius: 18, overflow: "hidden" }}>
            <AfficheCanvas
              layout={layout}
              width={canvasW}
              height={canvasH}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setFocused(null);
              }}
              editable
              onChangeLayer={(id, patch) => patchLayer(id, patch)}
              onDragChange={setDragging}
            />
            <AfficheSoonOverlay
              layout={layout}
              editable
              focused={focused}
              avatarUrl={user?.avatarUrl}
              fallbackSeller={user?.displayName}
              fallbackShop={user?.handle ? `@${user.handle.replace(/^@/, "")}` : ""}
              onFocus={(field) => {
                setFocused(field);
                setSelectedId(null);
              }}
              onChange={(patch) => setLayout((prev) => ({ ...prev, ...patch }))}
            />
          </View>
        </View>

        <View style={styles.row}>
          <Tool icon={<Type size={16} color={NAVY} />} label={t("publish.edit.addText")} onPress={addText} />
          <Tool
            icon={<ImagePlus size={16} color={NAVY} />}
            label={t("publish.affiche.addPhoto")}
            onPress={() => void addPhoto()}
          />
          <Tool
            icon={<ImagePlus size={16} color={NAVY} />}
            label={t("publish.affiche.bg")}
            onPress={() => void setBackground()}
          />
          {selected ? (
            <Tool
              icon={<Trash2 size={16} color={NAVY} />}
              label={t("common.delete")}
              onPress={() => {
                setLayout((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== selected.id) }));
                setSelectedId(null);
              }}
            />
          ) : null}
        </View>

        {selected?.kind === "text" ? (
          <TextInput
            autoFocus
            value={selected.text}
            onChangeText={(text) => patchLayer(selected.id, { text })}
            placeholder={t("publish.edit.textPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.input}
          />
        ) : null}

        {selected?.kind === "text" ? (
          <>
            <Text style={styles.section}>{t("publish.affiche.font")}</Text>
            <View style={styles.row}>
              {AFFICHE_FONTS.map((font) => (
                <Press
                  key={font}
                  onPress={() => patchLayer(selected.id, { font })}
                  style={[styles.chip, selected.font === font && styles.chipOn]}
                >
                  <Text style={styles.chipTxt}>{font}</Text>
                </Press>
              ))}
            </View>
            <Text style={styles.section}>{t("publish.edit.text")}</Text>
            <View style={styles.row}>
              {AFFICHE_COLORS.map((color) => (
                <Press
                  key={color}
                  onPress={() => patchLayer(selected.id, { color })}
                  style={[styles.swatch, { backgroundColor: color }]}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.section}>{t("publish.affiche.bg")}</Text>
            <View style={styles.row}>
              {AFFICHE_COLORS.map((color) => (
                <Press
                  key={color}
                  onPress={() => setLayout((prev) => ({ ...prev, backgroundColor: color }))}
                  style={[styles.swatch, { backgroundColor: color }]}
                />
              ))}
            </View>
          </>
        )}

        <Press onPress={() => void publish()} disabled={busy} style={[styles.cta, { opacity: busy ? 0.5 : 1 }]}>
          {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.ctaTxt}>{t("publish.affiche.publish")}</Text>}
        </Press>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tool({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} style={styles.tool}>
      {icon}
      <Text style={styles.toolTxt}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: 12, paddingBottom: 48, gap: 10 },
  hint: { color: "rgba(255,255,255,0.65)", fontWeight: "600", textAlign: "center" },
  stageWrap: { alignItems: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tool: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toolTxt: { color: NAVY, fontWeight: "800", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    minHeight: 44,
  },
  section: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 12, marginTop: 4 },
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
  cta: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTxt: { color: NAVY, fontWeight: "900", fontSize: 15 },
});
