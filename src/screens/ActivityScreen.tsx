import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronLeft, Package, Radio } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../components/Press";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";
import { GOLD } from "../theme";

const NOTIFS = [
  { id: "1", title: "Aïcha Beauty est en live", body: "Nouveautés maquillage — prix cassés ce soir", time: "il y a 2 min" },
  { id: "2", title: "Rappel live", body: "Kevin Sneaks démarre dans 15 min", time: "il y a 12 min" },
  { id: "3", title: "Commande expédiée", body: "Jordan 4 Retro · Kevin Sneaks", time: "il y a 1 j" },
];

export function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { closeOverlay } = useNav();
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Press onPress={closeOverlay} style={styles.back}>
          <ChevronLeft size={24} color={colors.foreground} />
          <Text style={{ fontWeight: "700", color: colors.foreground }}>{t("common.back")}</Text>
        </Press>
        <Text style={[styles.title, { color: colors.foreground }]}>{t("activity.title")}</Text>
        <View style={{ width: 72 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {NOTIFS.map((n) => (
          <View key={n.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.icon}>
              {n.id === "3" ? <Package size={18} color={GOLD} /> : n.id === "1" ? <Radio size={18} color={GOLD} /> : <Bell size={18} color={GOLD} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: colors.foreground }}>{n.title}</Text>
              <Text style={{ color: colors.mutedForeground, marginTop: 2 }}>{n.body}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4 }}>{n.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  back: { flexDirection: "row", alignItems: "center", minWidth: 0, paddingRight: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  card: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(232,185,59,0.15)", alignItems: "center", justifyContent: "center" },
});
