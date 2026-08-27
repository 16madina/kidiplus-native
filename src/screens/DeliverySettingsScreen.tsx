import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { CountrySelect } from "../components/CountrySelect";
import { FieldLabel } from "../components/FormField";
import { GoldButton } from "../components/Buttons";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { countryFlag, suggestionsFor } from "../lib/countries";
import {
  fetchDeliverySettingsOrDefault,
  upsertDeliverySettings,
  type DeliveryMode,
  type DeliveryZone,
} from "../lib/delivery";
import { currencySymbol, normalizeCurrency } from "../lib/money";
import { GOLD, NAVY } from "../theme";

const MODES: DeliveryMode[] = ["flat", "zones", "courier"];

export function DeliverySettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [mode, setMode] = useState<DeliveryMode>("flat");
  const [flatFee, setFlatFee] = useState("0");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneCountry, setZoneCountry] = useState("CI");
  const [zoneDraft, setZoneDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const symbol = currencySymbol(normalizeCurrency(user?.walletCurrency));

  useEffect(() => {
    const id = user?.id;
    if (!id) return;
    let alive = true;
    void fetchDeliverySettingsOrDefault(id).then((s) => {
      if (!alive) return;
      setMode(s.mode);
      setFlatFee(String(s.flat_fee ?? 0));
      setZones(s.zones);
      if (s.zones[0]?.country) setZoneCountry(s.zones[0].country);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const addZone = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (zones.some((z) => z.country === zoneCountry && z.name.toLowerCase() === trimmed.toLowerCase())) {
      setZoneDraft("");
      return;
    }
    setZones((prev) => [...prev, { country: zoneCountry, name: trimmed, fee: 0 }]);
    setZoneDraft("");
  };

  const save = async () => {
    const id = user?.id;
    if (!id || saving) return;
    if (mode === "zones" && zones.length === 0) {
      flash(t("delivery.zonesRequired"));
      return;
    }
    setSaving(true);
    const res = await upsertDeliverySettings(id, {
      mode,
      flat_fee: Number(String(flatFee).replace(",", ".")) || 0,
      zones,
    });
    setSaving(false);
    flash(res.ok ? t("delivery.saved") : res.error || t("delivery.saveFailed"));
  };

  const suggestions = suggestionsFor(zoneCountry).filter(
    (s) => !zones.some((z) => z.country === zoneCountry && z.name === s),
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("delivery.settings")} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
          ) : (
            <>
              <FieldLabel label={t("delivery.mode")} />
              <SurfaceCard padded={false}>
                {MODES.map((m, i) => {
                  const on = mode === m;
                  return (
                    <Press
                      key={m}
                      onPress={() => setMode(m)}
                      style={[styles.modeRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                    >
                      <View style={[styles.radio, { borderColor: on ? GOLD : colors.border }]}>
                        {on ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700", fontSize: 14, color: colors.foreground }}>
                          {t(`delivery.modes.${m}`)}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                          {t(`delivery.modeHelp.${m}`)}
                        </Text>
                      </View>
                    </Press>
                  );
                })}
              </SurfaceCard>

              {mode === "flat" ? (
                <View>
                  <FieldLabel label={`${t("delivery.flatFee")} (${symbol})`} />
                  <TextInput
                    value={flatFee}
                    onChangeText={setFlatFee}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                    ]}
                  />
                </View>
              ) : null}

              {mode === "zones" ? (
                <>
                  <CountrySelect
                    label={t("delivery.zoneCountry")}
                    value={zoneCountry}
                    hintCountry={zoneCountry}
                    onChange={setZoneCountry}
                  />
                  <View>
                    <FieldLabel label={t("delivery.addZone")} />
                    <View style={styles.addRow}>
                      <TextInput
                        value={zoneDraft}
                        onChangeText={setZoneDraft}
                        onSubmitEditing={() => addZone(zoneDraft)}
                        placeholder={t("delivery.quickAddPlaceholder")}
                        placeholderTextColor={colors.mutedForeground}
                        style={[
                          styles.input,
                          { flex: 1, color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                        ]}
                      />
                      <Press onPress={() => addZone(zoneDraft)} style={styles.addBtn}>
                        <Plus size={18} color={NAVY} />
                      </Press>
                    </View>
                  </View>
                  {suggestions.length > 0 ? (
                    <View style={styles.chips}>
                      {suggestions.slice(0, 10).map((s) => (
                        <Press
                          key={s}
                          onPress={() => addZone(s)}
                          style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>{s}</Text>
                        </Press>
                      ))}
                    </View>
                  ) : null}
                  {zones.length > 0 ? (
                    <SurfaceCard padded={false}>
                      {zones.map((z, i) => (
                        <View
                          key={`${z.country}-${z.name}`}
                          style={[styles.zoneRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                        >
                          <Text style={{ fontSize: 16 }}>{countryFlag(z.country) || "🌍"}</Text>
                          <Text style={{ flex: 1, fontWeight: "600", fontSize: 14, color: colors.foreground }}>
                            {z.name}
                          </Text>
                          <TextInput
                            value={String(z.fee)}
                            onChangeText={(v) => {
                              const fee = Number(String(v).replace(",", ".")) || 0;
                              setZones((prev) => prev.map((x, j) => (j === i ? { ...x, fee } : x)));
                            }}
                            keyboardType="decimal-pad"
                            style={[
                              styles.feeInput,
                              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                            ]}
                          />
                          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "700" }}>{symbol}</Text>
                          <Press
                            onPress={() => setZones((prev) => prev.filter((_, j) => j !== i))}
                            style={{ minHeight: 36, minWidth: 36 }}
                          >
                            <Trash2 size={16} color="#C0392B" />
                          </Press>
                        </View>
                      ))}
                    </SurfaceCard>
                  ) : (
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{t("delivery.quickAddHint")}</Text>
                  )}
                </>
              ) : null}

              {mode === "courier" ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>
                  {t("delivery.courierNote")}
                </Text>
              ) : null}

              <GoldButton
                label={saving ? t("common.loading") : t("delivery.saveCta")}
                onPress={() => void save()}
                disabled={saving}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    fontSize: 14,
    fontWeight: "500",
  },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addBtn: {
    width: 46,
    height: 46,
    minWidth: 46,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: GOLD,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 32,
    minWidth: 0,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 54,
  },
  feeInput: {
    width: 72,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
});
