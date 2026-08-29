import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { pickImageFromLibrary } from "../../lib/pick-image";
import { uploadVitrineMedia } from "../../lib/vitrine";
import {
  AFFICHE_COLORS,
  AFFICHE_FONTS,
  createVitrineAffiche,
  joinAfficheEventAt,
  newAfficheLayout,
  splitAfficheEventAt,
  type AfficheLayout,
  type AfficheLayer,
} from "../../lib/vitrine-affiche";
import { GOLD, NAVY } from "../../theme";

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AfficheEditor({ onPublished }: { onPublished: () => void }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const canvasW = Math.min(width - 32, 360);
  const canvasH = Math.min(height * 0.5, canvasW * (16 / 9));
  const [layout, setLayout] = useState<AfficheLayout>(newAfficheLayout);
  const [selectedId, setSelectedId] = useState<string | null>("title");
  const [busy, setBusy] = useState(false);
  const when = splitAfficheEventAt(layout.eventAt);

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

  const setWhen = (date: string, time: string) => {
    setLayout((prev) => ({ ...prev, eventAt: joinAfficheEventAt(date, time) }));
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
          y: 0.52,
          scale: 1,
          color: "#FFFFFF",
          font: "system",
        },
      ],
    }));
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
      layers: [...prev.layers, { id, kind: "image", uri: url, x: 0.5, y: 0.62, scale: 1 }],
    }));
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
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!selectedId}
    >
      <Text style={styles.hint}>{t("publish.afficheHint")}</Text>
      <View style={{ alignItems: "center" }}>
        <AfficheCanvas
          layout={layout}
          width={canvasW}
          height={canvasH}
          selectedId={selectedId}
          onSelect={setSelectedId}
          editable
          onChangeLayer={(id, patch) => patchLayer(id, patch)}
        />
      </View>
      <Text style={styles.pinch}>{t("publish.edit.pinchHint")}</Text>

      <View style={styles.row}>
        <Tool icon={<Type size={16} color={NAVY} />} label={t("publish.edit.addText")} onPress={addText} />
        <Tool icon={<ImagePlus size={16} color={NAVY} />} label={t("publish.affiche.addPhoto")} onPress={() => void addPhoto()} />
        <Tool icon={<ImagePlus size={16} color={NAVY} />} label={t("publish.affiche.bg")} onPress={() => void setBackground()} />
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
          value={selected.text}
          onChangeText={(text) => patchLayer(selected.id, { text })}
          placeholder={t("publish.edit.textPlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.45)"
          style={styles.input}
        />
      ) : null}

      <Text style={styles.section}>{t("publish.affiche.when")}</Text>
      <View style={styles.whenRow}>
        <TextInput
          value={when.date}
          onChangeText={(date) => setWhen(date, when.time)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={[styles.input, styles.whenField]}
        />
        <TextInput
          value={when.time}
          onChangeText={(time) => setWhen(when.date, time)}
          placeholder="HH:MM"
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={[styles.input, styles.whenField]}
        />
      </View>
      <Text style={styles.whenHint}>{t("publish.affiche.whenHint")}</Text>

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

      <Text style={styles.section}>{t("publish.edit.text")}</Text>
      <View style={styles.row}>
        {AFFICHE_COLORS.map((color) => (
          <Press
            key={color}
            onPress={() => {
              if (selected?.kind === "text") patchLayer(selected.id, { color });
              else setLayout((prev) => ({ ...prev, backgroundColor: color }));
            }}
            style={[styles.swatch, { backgroundColor: color }]}
          />
        ))}
      </View>

      <Press onPress={() => void publish()} disabled={busy} style={[styles.cta, { opacity: busy ? 0.5 : 1 }]}>
        {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.ctaTxt}>{t("publish.affiche.publish")}</Text>}
      </Press>
    </ScrollView>
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
  page: { padding: 16, paddingBottom: 40, gap: 10 },
  hint: { color: "rgba(255,255,255,0.65)", fontWeight: "600", textAlign: "center" },
  pinch: { color: GOLD, fontWeight: "700", fontSize: 12, textAlign: "center" },
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
  whenRow: { flexDirection: "row", gap: 8 },
  whenField: { flex: 1 },
  whenHint: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600" },
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
