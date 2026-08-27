import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MapPin, Plus, Star } from "lucide-react-native";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAppTheme } from "../context/theme";
import { GOLD } from "../theme";
import { MOCK_ADDRESSES, type Address } from "../mock/account";

export function AddressesScreen() {
  const { colors, dark } = useAppTheme();
  const [list, setList] = useState<Address[]>(MOCK_ADDRESSES);
  const [toast, setToast] = useState<string | null>(null);

  const add = () => {
    setList((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        label: "Nouvelle adresse",
        line: "14 boulevard Haussmann",
        city: "75009 Paris",
      },
    ]);
    setToast("Adresse ajoutée (mock)");
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title="Mes adresses" />
      <ScrollView contentContainerStyle={styles.body}>
        {list.map((a) => (
          <Press
            key={a.id}
            onPress={() => {
              setList((prev) => prev.map((x) => ({ ...x, primary: x.id === a.id })));
              setToast("Adresse par défaut mise à jour");
              setTimeout(() => setToast(null), 1800);
            }}
            style={{ alignItems: "stretch" }}
          >
            <Glass tone={a.primary ? "gold" : dark ? "dark" : "light"} intensity={36} radius={18}>
              <View style={styles.card}>
                <View style={styles.icon}>
                  <MapPin size={18} color={GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontWeight: "800", color: colors.foreground }}>{a.label}</Text>
                    {a.primary ? <Star size={12} color={GOLD} fill={GOLD} /> : null}
                  </View>
                  <Text style={{ color: colors.mutedForeground, marginTop: 2 }}>{a.line}</Text>
                  <Text style={{ color: colors.mutedForeground }}>{a.city}</Text>
                </View>
              </View>
            </Glass>
          </Press>
        ))}
        <GoldButton label="Ajouter une adresse" onPress={add} icon={<Plus size={18} color="#151022" />} />
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  card: { flexDirection: "row", gap: 12, padding: 14, alignItems: "center" },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(232,185,59,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
