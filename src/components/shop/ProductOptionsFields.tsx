import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import {
  PRESET_COLORS,
  PRESET_SIZES,
  PRODUCT_CONDITIONS,
  togglePreset,
  type ProductCondition,
} from "../../lib/live-product-options";
import { GOLD, NAVY } from "../../theme";

export function ProductOptionsFields({
  brand,
  condition,
  colors,
  sizes,
  onBrand,
  onCondition,
  onColors,
  onSizes,
  light = true,
}: {
  brand: string;
  condition: ProductCondition | null;
  colors: string[];
  sizes: string[];
  onBrand: (v: string) => void;
  onCondition: (v: ProductCondition | null) => void;
  onColors: (v: string[]) => void;
  onSizes: (v: string[]) => void;
  light?: boolean;
}) {
  const { t } = useTranslation();
  const fg = light ? NAVY : "#fff";
  const muted = light ? "#6B7289" : "rgba(255,255,255,0.65)";
  const border = light ? "#E5E7EB" : "rgba(232,185,59,0.38)";
  const chipBg = light ? "#F3F4F6" : "rgba(16,20,40,0.7)";

  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.section, { color: fg }]}>{t("productOptions.title", "Options")}</Text>
      <Text style={[styles.hint, { color: muted }]}>{t("productOptions.subtitle")}</Text>
      <TextInput
        value={brand}
        onChangeText={onBrand}
        placeholder={t("productOptions.brandPlaceholder")}
        placeholderTextColor={muted}
        style={[styles.input, { color: fg, borderColor: border }]}
      />
      <Text style={[styles.label, { color: fg }]}>{t("productOptions.conditionLabel")}</Text>
      <View style={styles.row}>
        {PRODUCT_CONDITIONS.map((c) => {
          const on = condition === c;
          return (
            <Press
              key={c}
              onPress={() => onCondition(on ? null : c)}
              style={[styles.chip, { borderColor: border, backgroundColor: chipBg }, on && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, { color: fg }, on && styles.chipTxtOn]}>
                {t(`productOptions.condition.${c === "like_new" ? "likeNew" : c}`)}
              </Text>
            </Press>
          );
        })}
      </View>
      <Text style={[styles.label, { color: fg }]}>{t("productOptions.colors")}</Text>
      <View style={styles.row}>
        {PRESET_COLORS.map((c) => {
          const on = colors.includes(c);
          return (
            <Press
              key={c}
              onPress={() => onColors(togglePreset(colors, c))}
              style={[styles.chip, { borderColor: border, backgroundColor: chipBg }, on && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, { color: fg }, on && styles.chipTxtOn]}>{c}</Text>
            </Press>
          );
        })}
      </View>
      <Text style={[styles.label, { color: fg }]}>{t("productOptions.sizes")}</Text>
      <View style={styles.row}>
        {PRESET_SIZES.map((s) => {
          const on = sizes.includes(s);
          return (
            <Press
              key={s}
              onPress={() => onSizes(togglePreset(sizes, s))}
              style={[styles.chip, { borderColor: border, backgroundColor: chipBg }, on && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, { color: fg }, on && styles.chipTxtOn]}>{s}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: "800", fontSize: 14 },
  hint: { fontSize: 12, marginTop: -6 },
  label: { fontWeight: "700", fontSize: 13 },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontWeight: "600",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipOn: { backgroundColor: GOLD, borderColor: GOLD },
  chipTxt: { fontWeight: "700", fontSize: 12 },
  chipTxtOn: { color: "#0a0a12" },
});
