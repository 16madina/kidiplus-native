import { useMemo, useState } from "react";
import {
  Modal,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../context/theme";
import {
  CONTINENT_LABEL,
  countryFlag,
  countryName,
  normalizeCountryCode,
  searchCountries,
  type Continent,
  type CountryOption,
} from "../lib/countries";
import { FieldBox, FieldLabel } from "./FormField";
import { Press } from "./Press";

type Props = {
  label: string;
  required?: boolean;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  hintCountry?: string | null;
  includeOther?: boolean;
};

export function CountrySelect({
  label,
  required,
  value,
  onChange,
  placeholder,
  hintCountry,
  includeOther,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isEn = i18n.language.toLowerCase().startsWith("en");

  const selectedCode = normalizeCountryCode(value);
  const flag = countryFlag(value);
  const name = countryName(value, i18n.language);
  const isOther =
    !selectedCode &&
    (value.startsWith("🌍") || value.toLowerCase() === "autre" || value.toLowerCase() === "other");
  const display =
    selectedCode && name
      ? `${flag}  ${name}`
      : isOther
        ? value || "🌍 Autre"
        : placeholder || t("address.pickCountry");

  const sections = useMemo(() => {
    const groups = searchCountries(query, hintCountry || value || null);
    const out: Array<{ title: string; continent: Continent; data: CountryOption[] }> = groups.map(
      (g) => ({
        title: isEn ? CONTINENT_LABEL[g.continent].en : CONTINENT_LABEL[g.continent].fr,
        continent: g.continent,
        data: g.countries,
      }),
    );
    if (includeOther && !query.trim()) {
      out.push({
        title: isEn ? "Other" : "Autre",
        continent: "AN",
        data: [{ code: "__OTHER__", name: "Autre", nameEn: "Other", flag: "🌍", continent: "AN" }],
      });
    }
    return out;
  }, [query, hintCountry, value, isEn, includeOther]);

  const pick = (c: CountryOption) => {
    onChange(c.code === "__OTHER__" ? "" : c.code);
    setOpen(false);
    setQuery("");
  };

  return (
    <View>
      <FieldLabel label={label} required={required} />
      <Press onPress={() => setOpen(true)} style={styles.triggerPress}>
        <FieldBox style={styles.trigger}>
          <Text
            numberOfLines={1}
            style={[styles.triggerTxt, { color: name || isOther ? colors.foreground : colors.mutedForeground }]}
          >
            {display}
          </Text>
          <ChevronDown size={16} color={colors.mutedForeground} />
        </FieldBox>
      </Press>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.foreground }]}>{label}</Text>
            <Press
              onPress={() => {
                setOpen(false);
                setQuery("");
              }}
              style={styles.close}
            >
              <X size={18} color={colors.foreground} />
            </Press>
          </View>
          <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Search size={14} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("delivery.searchCountry")}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>
          {sections.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, padding: 16 }}>{t("delivery.noCountryFound")}</Text>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              stickySectionHeadersEnabled
              renderSectionHeader={({ section }) => (
                <View style={[styles.section, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.sectionTxt, { color: colors.mutedForeground }]}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const on =
                  item.code === "__OTHER__" ? isOther && !selectedCode : item.code === selectedCode;
                return (
                  <Press onPress={() => pick(item)} style={styles.rowPress}>
                    <View style={[styles.row, on && { backgroundColor: colors.muted }]}>
                      <Text style={styles.flag}>{item.flag}</Text>
                      <Text style={[styles.rowName, { color: colors.foreground }]}>
                        {isEn ? item.nameEn : item.name}
                      </Text>
                      {on ? <Text style={styles.check}>✓</Text> : null}
                    </View>
                  </Press>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  triggerPress: { alignItems: "stretch", minHeight: 0, minWidth: 0 },
  trigger: { justifyContent: "space-between", gap: 8 },
  triggerTxt: { flex: 1, fontSize: 14, fontWeight: "500" },
  sheet: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { flex: 1, fontSize: 17, fontWeight: "700" },
  close: { width: 36, height: 36, borderRadius: 18 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  section: { paddingHorizontal: 16, paddingVertical: 6 },
  sectionTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  rowPress: { alignItems: "stretch", minHeight: 0, minWidth: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  flag: { fontSize: 20, width: 32 },
  rowName: { flex: 1, fontSize: 15, fontWeight: "500" },
  check: { fontSize: 14, fontWeight: "800", color: "#1B7A3A" },
});
