import { useMemo, useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MapPin, Plus, Star, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { CountrySelect } from "../components/CountrySelect";
import { FormField } from "../components/FormField";
import { GoldButton } from "../components/Buttons";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import {
  createAddress,
  deleteAddress,
  fetchMyAddresses,
  formatAddressCity,
  formatAddressLine,
  normalizeCountryCode,
  setDefaultAddress,
  updateAddress,
  type AddressInput,
  type AddressRow,
} from "../lib/addresses";
import { countryFlag, isCompactAddressCountry, suggestionsFor } from "../lib/countries";
import { GOLD } from "../theme";

type FormState = AddressInput & { id?: string };

function blankForm(country: string): FormState {
  return {
    label: "",
    full_name: "",
    phone: "",
    country,
    city: "",
    zone_or_commune: "",
    street_address: "",
    postal_code: "",
    details: "",
    is_default: true,
  };
}

function confirmDelete(message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(message) : false);
  }
  return new Promise((resolve) => {
    Alert.alert("", message, [
      { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export function AddressesScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [list, setList] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const reload = async () => {
    const id = user?.id;
    if (!id) {
      setList([]);
      setLoading(false);
      return;
    }
    setList(await fetchMyAddresses(id));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const openNew = () => {
    setForm(blankForm(normalizeCountryCode(user?.country) || "CI"));
  };

  const openEdit = (row: AddressRow) => {
    setForm({
      id: row.id,
      label: row.label,
      full_name: row.full_name,
      phone: row.phone,
      country: normalizeCountryCode(row.country),
      city: row.city,
      zone_or_commune: row.zone_or_commune ?? "",
      street_address: row.street_address ?? "",
      postal_code: row.postal_code ?? "",
      region: row.region ?? "",
      details: row.details ?? "",
      is_default: row.is_default,
    });
  };

  const save = async () => {
    if (!user?.id || !form) return;
    const compact = isCompactAddressCountry(form.country);
    if (!form.full_name.trim()) {
      flash(t("address.nameRequired"));
      return;
    }
    if (!form.phone.trim()) {
      flash(t("address.phoneRequired"));
      return;
    }
    if (!form.country) {
      flash(t("address.countryRequired"));
      return;
    }
    if (!form.city.trim()) {
      flash(t("address.cityRequired"));
      return;
    }
    if (compact && !(form.zone_or_commune ?? "").trim()) {
      flash(t("address.communeRequired"));
      return;
    }
    if (!compact && !(form.street_address ?? "").trim()) {
      flash(t("address.streetRequired"));
      return;
    }
    if (!compact && !(form.postal_code ?? "").trim()) {
      flash(t("address.postalRequired"));
      return;
    }
    setSaving(true);
    const payload: AddressInput = {
      label: form.label,
      full_name: form.full_name,
      phone: form.phone,
      country: form.country,
      city: form.city,
      zone_or_commune: form.zone_or_commune,
      street_address: form.street_address,
      postal_code: form.postal_code,
      region: form.region,
      details: form.details,
      is_default: form.is_default,
    };
    const res = form.id
      ? await updateAddress(form.id, payload)
      : await createAddress(user.id, payload);
    setSaving(false);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    flash(t("address.saved"));
    setForm(null);
    setLoading(true);
    await reload();
  };

  const makeDefault = async (id: string) => {
    const res = await setDefaultAddress(id);
    if (!res.ok) {
      flash(res.error ?? t("errors.generic"));
      return;
    }
    flash(t("address.default"));
    await reload();
  };

  const remove = async (id: string) => {
    const ok = await confirmDelete(t("address.confirmDelete"));
    if (!ok) return;
    const res = await deleteAddress(id);
    if (!res.ok) {
      flash(res.error === "address_in_use" ? t("address.inUse") : res.error);
      return;
    }
    flash(t("address.deleted"));
    setForm(null);
    await reload();
  };

  if (form) {
    return (
      <AddressForm
        form={form}
        setForm={setForm}
        saving={saving}
        toast={toast}
        onClose={() => setForm(null)}
        onSave={() => void save()}
        onRemove={(id) => void remove(id)}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("address.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
        ) : list.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 8 }}>{t("address.empty")}</Text>
        ) : (
          list.map((a) => (
            <SurfaceCard key={a.id} onPress={() => openEdit(a)}>
              <View style={styles.card}>
                <View style={styles.icon}>
                  <MapPin size={18} color={GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontWeight: "800", color: colors.foreground }}>
                      {a.label?.trim() || a.full_name}
                    </Text>
                    {a.is_default ? <Star size={12} color={GOLD} fill={GOLD} /> : null}
                  </View>
                  <Text style={{ color: colors.mutedForeground, marginTop: 2 }}>{formatAddressLine(a)}</Text>
                  <Text style={{ color: colors.mutedForeground }}>
                    {countryFlag(a.country) ? `${countryFlag(a.country)}  ` : ""}
                    {formatAddressCity(a)}
                  </Text>
                </View>
                {!a.is_default ? (
                  <Press onPress={() => void makeDefault(a.id)} style={{ minHeight: 32, minWidth: 0 }}>
                    <Text style={{ color: GOLD, fontWeight: "700", fontSize: 12 }}>{t("address.setDefault")}</Text>
                  </Press>
                ) : null}
              </View>
            </SurfaceCard>
          ))
        )}
        <GoldButton label={t("address.add")} onPress={openNew} icon={<Plus size={18} color="#151022" />} />
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

function AddressForm({
  form,
  setForm,
  saving,
  toast,
  onClose,
  onSave,
  onRemove,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  saving: boolean;
  toast: string | null;
  onClose: () => void;
  onSave: () => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const compact = isCompactAddressCountry(form.country);
  const zones = useMemo(() => {
    const all = suggestionsFor(form.country);
    const q = (form.zone_or_commune ?? "").trim().toLowerCase();
    if (!q) return all.slice(0, 8);
    return all.filter((z) => z.toLowerCase().includes(q)).slice(0, 8);
  }, [form.country, form.zone_or_commune]);

  const [autoSuggestions, setAutoSuggestions] = useState<Array<{ display: string; street: string; city: string; postal: string; country: string }>>([]);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onStreetChange = (text: string) => {
    setForm({ ...form, street_address: text });
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (text.trim().length < 4) { setAutoSuggestions([]); return; }
    autoTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&addressdetails=1`);
        const data = await res.json();
        const items = (data as any[]).map((r: any) => ({
          display: r.display_name?.split(",").slice(0, 3).join(",") ?? "",
          street: r.address?.road ?? r.display_name?.split(",")[0] ?? "",
          city: r.address?.city ?? r.address?.town ?? r.address?.village ?? "",
          postal: r.address?.postcode ?? "",
          country: r.address?.country_code?.toUpperCase() ?? "",
        }));
        setAutoSuggestions(items);
      } catch {
        setAutoSuggestions([]);
      }
    }, 350);
  };

  const pickSuggestion = (s: typeof autoSuggestions[0]) => {
    setForm({
      ...form,
      street_address: s.street,
      city: s.city,
      postal_code: s.postal,
      country: s.country || form.country,
    });
    setAutoSuggestions([]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader
        title={form.id ? t("address.edit") : t("address.add")}
        onBack={onClose}
        backLabel={t("common.back")}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <FormField
            required
            label={t("address.fields.fullName")}
            value={form.full_name}
            onChangeText={(full_name) => setForm({ ...form, full_name })}
          />
          <FormField
            required
            label={t("address.fields.phone")}
            value={form.phone}
            onChangeText={(phone) => setForm({ ...form, phone })}
            keyboardType="phone-pad"
          />
          <CountrySelect
            required
            label={t("address.fields.country")}
            value={form.country ?? ""}
            hintCountry={form.country}
            onChange={(country) => setForm({ ...form, country })}
          />
          {compact ? (
            <>
              <FormField
                required
                label={t("address.fields.city")}
                value={form.city}
                onChangeText={(city) => setForm({ ...form, city })}
              />
              <FormField
                required
                label={t("address.fields.zoneOrCommune")}
                value={form.zone_or_commune ?? ""}
                onChangeText={(zone_or_commune) => setForm({ ...form, zone_or_commune })}
              />
              {zones.length > 0 ? (
                <View style={styles.chips}>
                  {zones.map((z) => (
                    <Press
                      key={z}
                      onPress={() => setForm({ ...form, zone_or_commune: z })}
                      style={[
                        styles.chip,
                        {
                          borderColor: colors.border,
                          backgroundColor: form.zone_or_commune === z ? GOLD : colors.card,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: form.zone_or_commune === z ? "#151022" : colors.foreground,
                        }}
                      >
                        {z}
                      </Text>
                    </Press>
                  ))}
                </View>
              ) : null}
              <FormField
                label={t("address.fields.details")}
                placeholder={t("address.landmarkPlaceholder")}
                value={form.details ?? ""}
                onChangeText={(details) => setForm({ ...form, details })}
              />
              <FormField
                label={t("address.fields.streetOptional")}
                value={form.street_address ?? ""}
                onChangeText={(street_address) => setForm({ ...form, street_address })}
              />
            </>
          ) : (
            <>
              <FormField
                required
                label={t("address.fields.streetAddress")}
                placeholder={t("address.streetPlaceholder")}
                value={form.street_address ?? ""}
                onChangeText={onStreetChange}
              />
              {autoSuggestions.length > 0 && (
                <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {autoSuggestions.map((s, i) => (
                    <Press key={i} onPress={() => pickSuggestion(s)} style={styles.sugRow}>
                      <Text style={{ fontSize: 13, color: colors.foreground }} numberOfLines={1}>{s.display}</Text>
                    </Press>
                  ))}
                </View>
              )}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <FormField
                    required
                    label={t("address.fields.city")}
                    value={form.city}
                    onChangeText={(city) => setForm({ ...form, city })}
                  />
                </View>
                <View style={{ width: 120 }}>
                  <FormField
                    required
                    label={t("address.fields.postalCode")}
                    value={form.postal_code ?? ""}
                    onChangeText={(postal_code) => setForm({ ...form, postal_code })}
                  />
                </View>
              </View>
              <FormField
                label={t("address.fields.region")}
                value={form.region ?? ""}
                onChangeText={(region) => setForm({ ...form, region })}
              />
              <FormField
                label={t("address.fields.details")}
                value={form.details ?? ""}
                onChangeText={(details) => setForm({ ...form, details })}
              />
            </>
          )}
          <FormField
            label={t("address.fields.label")}
            value={form.label ?? ""}
            onChangeText={(label) => setForm({ ...form, label })}
            placeholder={t("address.fields.labelPlaceholder")}
          />
          <Press onPress={() => setForm({ ...form, is_default: !form.is_default })} style={{ alignItems: "stretch" }}>
            <SurfaceCard>
              <View style={styles.defaultRow}>
                <Star size={16} color={GOLD} fill={form.is_default ? GOLD : "none"} />
                <Text style={{ flex: 1, fontWeight: "600", fontSize: 14, color: colors.foreground }}>
                  {t("address.setDefault")}
                </Text>
                <Text style={{ color: GOLD, fontWeight: "800" }}>{form.is_default ? "ON" : "OFF"}</Text>
              </View>
            </SurfaceCard>
          </Press>
          <GoldButton
            label={saving ? t("common.loading") : t("common.save")}
            onPress={onSave}
            disabled={saving}
          />
          {form.id ? (
            <Press onPress={() => void onRemove(form.id!)} style={styles.delete}>
              <Trash2 size={16} color="#C0392B" />
              <Text style={{ color: "#C0392B", fontWeight: "800" }}>{t("address.delete")}</Text>
            </Press>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  card: { flexDirection: "row", gap: 12, alignItems: "center" },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(232,185,59,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -4 },
  chip: {
    minHeight: 32,
    minWidth: 0,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  row2: { flexDirection: "row", gap: 8 },
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 24 },
  delete: { minHeight: 44, flexDirection: "row", gap: 8 },
  suggestions: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: -6,
    overflow: "hidden",
  },
  sugRow: {
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
});
