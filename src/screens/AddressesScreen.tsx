import { useEffect, useState } from "react";
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
import { AuthInput } from "../components/AuthInput";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import {
  ADDRESS_COUNTRIES,
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
  const { colors, dark } = useAppTheme();
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
    setForm(
      blankForm(
        normalizeCountryCode(user?.country) || "CI",
      ),
    );
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
      details: row.details ?? "",
      is_default: row.is_default,
    });
  };

  const save = async () => {
    if (!user?.id || !form) return;
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
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <OverlayHeader
          title={form.id ? t("address.edit") : t("address.add")}
          onBack={() => setForm(null)}
          backLabel={t("common.back")}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <AuthInput
              label={t("address.fields.fullName")}
              value={form.full_name}
              onChangeText={(full_name) => setForm({ ...form, full_name })}
            />
            <AuthInput
              label={t("address.fields.phone")}
              value={form.phone}
              onChangeText={(phone) => setForm({ ...form, phone })}
              keyboardType="phone-pad"
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("address.fields.country")}</Text>
            <View style={styles.chips}>
              {ADDRESS_COUNTRIES.map((c) => {
                const on = form.country === c.code;
                return (
                  <Press key={c.code} onPress={() => setForm({ ...form, country: c.code })} style={styles.chipPress}>
                    <Glass tone={on ? "gold" : dark ? "dark" : "light"} intensity={32} radius={999} elevated={false}>
                      <View style={styles.chip}>
                        <Text style={{ fontWeight: "700", fontSize: 12, color: on ? "#fff" : colors.foreground }}>
                          {c.label}
                        </Text>
                      </View>
                    </Glass>
                  </Press>
                );
              })}
            </View>
            <AuthInput
              label={t("address.fields.city")}
              value={form.city}
              onChangeText={(city) => setForm({ ...form, city })}
            />
            <AuthInput
              label={t("address.fields.zoneOrCommune")}
              value={form.zone_or_commune ?? ""}
              onChangeText={(zone_or_commune) => setForm({ ...form, zone_or_commune })}
            />
            <AuthInput
              label={t("address.fields.streetAddress")}
              value={form.street_address ?? ""}
              onChangeText={(street_address) => setForm({ ...form, street_address })}
            />
            <AuthInput
              label={t("address.fields.postalCode")}
              value={form.postal_code ?? ""}
              onChangeText={(postal_code) => setForm({ ...form, postal_code })}
            />
            <AuthInput
              label={t("address.fields.details")}
              value={form.details ?? ""}
              onChangeText={(details) => setForm({ ...form, details })}
            />
            <AuthInput
              label={t("address.fields.label")}
              value={form.label ?? ""}
              onChangeText={(label) => setForm({ ...form, label })}
              placeholder={t("address.fields.labelPlaceholder")}
            />
            <Press onPress={() => setForm({ ...form, is_default: !form.is_default })} style={{ alignItems: "stretch" }}>
              <Glass tone={form.is_default ? "gold" : dark ? "dark" : "light"} intensity={32} radius={16} elevated={false}>
                <View style={styles.defaultRow}>
                  <Star size={16} color={GOLD} fill={form.is_default ? GOLD : "none"} />
                  <Text style={{ flex: 1, fontWeight: "700", color: colors.foreground }}>{t("address.setDefault")}</Text>
                  <Text style={{ color: GOLD, fontWeight: "800" }}>{form.is_default ? "ON" : "OFF"}</Text>
                </View>
              </Glass>
            </Press>
            <GoldButton
              label={saving ? t("common.loading") : t("common.save")}
              onPress={() => void save()}
              disabled={saving}
            />
            {form.id ? (
              <Press onPress={() => void remove(form.id!)} style={styles.delete}>
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
            <Press key={a.id} onPress={() => openEdit(a)} onLongPress={() => void makeDefault(a.id)} style={{ alignItems: "stretch" }}>
              <Glass tone={a.is_default ? "gold" : dark ? "dark" : "light"} intensity={36} radius={18}>
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
                    <Text style={{ color: colors.mutedForeground }}>{formatAddressCity(a)}</Text>
                  </View>
                  {!a.is_default ? (
                    <Press onPress={() => void makeDefault(a.id)} style={{ minHeight: 32, minWidth: 0 }}>
                      <Text style={{ color: GOLD, fontWeight: "700", fontSize: 12 }}>{t("address.setDefault")}</Text>
                    </Press>
                  ) : null}
                </View>
              </Glass>
            </Press>
          ))
        )}
        <GoldButton label={t("address.add")} onPress={openNew} icon={<Plus size={18} color="#151022" />} />
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
  label: {
    marginBottom: 2,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipPress: { minHeight: 32, minWidth: 0 },
  chip: { height: 32, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 48 },
  delete: { minHeight: 44, flexDirection: "row", gap: 8 },
});
