import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { Glass } from "./Glass";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";

export function OverlayHeader({ title, onDark }: { title: string; onDark?: boolean }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { closeOverlay } = useNav();
  const fg = onDark ? "#fff" : colors.foreground;
  return (
    <View style={[styles.head, { paddingTop: insets.top }]}>
      <Press onPress={closeOverlay} style={styles.back}>
        <ChevronLeft size={24} color={fg} strokeWidth={2.2} />
        <Text style={{ fontWeight: "700", color: fg }}>{t("common.close")}</Text>
      </Press>
      <Text numberOfLines={1} style={[styles.title, { color: fg }]}>
        {title}
      </Text>
      <View style={{ width: 72 }} />
    </View>
  );
}

export function MockBanner({ text }: { text: string | null }) {
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View style={[styles.toast, { bottom: insets.bottom + 16 }]} pointerEvents="none">
      <Glass tone="dark" intensity={48} radius={16} padded>
        <Text style={styles.toastText}>{text}</Text>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8, zIndex: 50 },
  back: { flexDirection: "row", alignItems: "center", minWidth: 0, paddingRight: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  toast: { position: "absolute", left: 20, right: 20, zIndex: 20 },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
});
