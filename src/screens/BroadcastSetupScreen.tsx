import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar, Radio, Sparkles, Video } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useNav } from "../context/navigation";
import { GOLD, LIVE_RED, NAVY } from "../theme";
import { MOCK_SHOP_ITEMS } from "../mock/account";

export function BroadcastSetupScreen({ mode }: { mode: "now" | "schedule" }) {
  const { t } = useTranslation();
  const { closeOverlay } = useNav();
  const now = mode === "now";
  const [title, setTitle] = useState(now ? "Live shopping — drop du soir" : "Live programmé");
  const [picked, setPicked] = useState<string[]>([MOCK_SHOP_ITEMS[0]?.id ?? ""]);
  const [auctions, setAuctions] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = () => {
    setToast(now ? "Studio mock — LiveKit et caméra arrivent ensuite." : t("schedule.savedToast"));
    setTimeout(() => {
      setToast(null);
      closeOverlay();
    }, 1600);
  };

  return (
    <View style={styles.root}>
      <OverlayHeader title={now ? t("golive.entry.startNow") : t("schedule.planningTitle")} onDark />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.preview}>
          <LinearGradient colors={["#0B1436", "#1C2440", "#10162B"]} style={StyleSheet.absoluteFill} />
          <Video size={36} color={GOLD} />
          <Text style={styles.previewLabel}>Caméra mock</Text>
          <Text style={styles.previewSub}>LiveKit + micro seront branchés ensuite</Text>
          {now ? (
            <View style={styles.livePill}>
              <View style={styles.dot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <Calendar size={16} color={GOLD} />
          )}
        </View>

        <Text style={styles.label}>{t("schedule.form.titleLabel")}</Text>
        <Glass tone="dark" intensity={32} radius={16} elevated={false}>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor="rgba(255,255,255,0.45)" />
        </Glass>

        <Text style={styles.label}>{t("schedule.form.productsTitle")}</Text>
        {MOCK_SHOP_ITEMS.map((item) => {
          const on = picked.includes(item.id);
          return (
            <Press key={item.id} onPress={() => toggle(item.id)} style={{ alignItems: "stretch" }}>
              <Glass tone={on ? "gold" : "dark"} intensity={32} radius={16} elevated={false}>
                <View style={styles.prod}>
                  <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontWeight: "800" }}>{item.name}</Text>
                    <Text style={{ color: GOLD, fontWeight: "700", marginTop: 2 }}>{item.price}</Text>
                  </View>
                  <Text style={{ color: on ? GOLD : "rgba(255,255,255,0.5)", fontWeight: "800" }}>{on ? "✓" : "+"}</Text>
                </View>
              </Glass>
            </Press>
          );
        })}

        <Press onPress={() => setAuctions((v) => !v)} style={{ alignItems: "stretch" }}>
          <Glass tone={auctions ? "gold" : "dark"} intensity={32} radius={16} elevated={false}>
            <View style={styles.opt}>
              <Sparkles size={16} color={GOLD} />
              <Text style={{ flex: 1, color: "#fff", fontWeight: "700" }}>{t("schedule.form.optAuctions")}</Text>
              <Text style={{ color: GOLD, fontWeight: "800" }}>{auctions ? "ON" : "OFF"}</Text>
            </View>
          </Glass>
        </Press>

        <GoldButton
          label={now ? t("golive.entry.startNowShort") : t("schedule.form.cta")}
          icon={now ? <Radio size={16} color="#151022" /> : <Calendar size={16} color="#151022" />}
          onPress={submit}
        />
        <Text style={styles.footnote}>
          {picked.length} article{picked.length > 1 ? "s" : ""} · {auctions ? "enchères on" : "prix fixe"}
        </Text>
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  preview: {
    height: 180,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(232,185,59,0.35)",
  },
  previewLabel: { color: "#fff", fontWeight: "800", fontSize: 16 },
  previewSub: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  livePill: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: LIVE_RED,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  label: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  input: { height: 48, color: "#fff", paddingHorizontal: 16, fontSize: 15 },
  prod: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#1C2440" },
  opt: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 52 },
  footnote: { color: "rgba(255,255,255,0.55)", textAlign: "center", fontSize: 12, fontWeight: "600" },
});
