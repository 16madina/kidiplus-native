import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { Radio, Save } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import {
  DEFAULT_PRELAUNCH_LIVE_SIM,
  fetchPrelaunchLiveSimConfigForAdmin,
  savePrelaunchLiveSimConfig,
  type PrelaunchLiveSimConfig,
} from "../../lib/prelaunch-live-sim";
import { useAppTheme } from "../../context/theme";
import { GOLD, NAVY } from "../../theme";

const EMERALD = "#059669";

export function AdminPrelaunchSimPanel({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [cfg, setCfg] = useState<PrelaunchLiveSimConfig>({ ...DEFAULT_PRELAUNCH_LIVE_SIM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPrelaunchLiveSimConfigForAdmin()
      .then((next) => {
        if (!cancelled) setCfg(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = <K extends keyof PrelaunchLiveSimConfig>(key: K, value: PrelaunchLiveSimConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
    setSavedLabel(null);
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await savePrelaunchLiveSimConfig(cfg);
      setCfg(saved);
      const summary = saved.enabled
        ? t("admin.prelaunchSim.savedOnDetail", { min: saved.viewersMin, max: saved.viewersMax })
        : t("admin.prelaunchSim.savedOffDetail");
      setSavedLabel(summary);
      flash(summary);
    } catch (e) {
      flash(e instanceof Error ? e.message : t("admin.prelaunchSim.saveFail"));
      setSavedLabel(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Radio size={18} color={cfg.enabled ? EMERALD : colors.mutedForeground} />
          <Text style={[styles.title, { color: colors.foreground }]}>{t("admin.prelaunchSim.title")}</Text>
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t("admin.prelaunchSim.panelHint")}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("admin.prelaunchSim.master")}</Text>
            <Text style={[styles.hint, { marginTop: 2 }]}>
              {cfg.enabled ? t("admin.prelaunchSim.statusOn") : t("admin.prelaunchSim.statusOff")}
            </Text>
          </View>
          <OvalToggle
            on={cfg.enabled}
            label={cfg.enabled ? t("admin.prelaunchSim.turnOff") : t("admin.prelaunchSim.turnOn")}
            onPress={() => patch("enabled", !cfg.enabled)}
          />
        </View>
      </View>

      {cfg.enabled ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("admin.prelaunchSim.viewersTitle")}</Text>
            <Text style={[styles.hint, { marginTop: 4, marginBottom: 10 }]}>{t("admin.prelaunchSim.viewersHint")}</Text>
            <View style={styles.two}>
              <NumField
                label={t("admin.prelaunchSim.viewersMin")}
                value={cfg.viewersMin}
                min={1}
                max={5000}
                onChange={(n) => patch("viewersMin", n)}
              />
              <NumField
                label={t("admin.prelaunchSim.viewersMax")}
                value={cfg.viewersMax}
                min={1}
                max={5000}
                onChange={(n) => patch("viewersMax", n)}
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("admin.prelaunchSim.commentsTitle")}</Text>
            <Text style={[styles.hint, { marginTop: 4, marginBottom: 10 }]}>{t("admin.prelaunchSim.commentsHint")}</Text>
            <View style={styles.two}>
              <NumField
                label={t("admin.prelaunchSim.commentMin")}
                value={cfg.commentEverySecMin}
                min={1}
                max={120}
                suffix="s"
                onChange={(n) => patch("commentEverySecMin", n)}
              />
              <NumField
                label={t("admin.prelaunchSim.commentMax")}
                value={cfg.commentEverySecMax}
                min={1}
                max={120}
                suffix="s"
                onChange={(n) => patch("commentEverySecMax", n)}
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <NumField
                label={t("admin.prelaunchSim.heartChance")}
                value={cfg.heartChancePct}
                min={0}
                max={100}
                suffix="%"
                onChange={(n) => patch("heartChancePct", n)}
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("admin.prelaunchSim.bidsTitle")}</Text>
                <Text style={[styles.hint, { marginTop: 4 }]}>{t("admin.prelaunchSim.bidsHint")}</Text>
              </View>
              <OvalToggle
                on={cfg.fakeBids}
                label={cfg.fakeBids ? t("admin.prelaunchSim.turnOn") : t("admin.prelaunchSim.turnOff")}
                onPress={() => patch("fakeBids", !cfg.fakeBids)}
              />
            </View>
            {cfg.fakeBids ? (
              <View style={[styles.two, { marginTop: 12 }]}>
                <NumField
                  label={t("admin.prelaunchSim.bidMin")}
                  value={cfg.bidEverySecMin}
                  min={1}
                  max={120}
                  suffix="s"
                  onChange={(n) => patch("bidEverySecMin", n)}
                />
                <NumField
                  label={t("admin.prelaunchSim.bidMax")}
                  value={cfg.bidEverySecMax}
                  min={1}
                  max={120}
                  suffix="s"
                  onChange={(n) => patch("bidEverySecMax", n)}
                />
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <Press onPress={() => void onSave()} disabled={saving} style={[styles.save, saving && { opacity: 0.5 }]}>
        <Save size={16} color="#fff" />
        <Text style={styles.saveTxt}>{saving ? t("admin.prelaunchSim.saving") : t("admin.prelaunchSim.save")}</Text>
      </Press>
      {savedLabel ? <Text style={styles.saved}>{savedLabel}</Text> : null}
    </View>
  );
}

function OvalToggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={[styles.oval, on ? styles.ovalOn : styles.ovalOff]}>
      <Text style={[styles.ovalTxt, { color: on ? "#fff" : NAVY }]}>{label}</Text>
    </Press>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, "");
    if (cleaned === "") {
      onChange(min);
      setDraft(String(min));
      return;
    }
    const n = Number(cleaned);
    const clamped = Math.min(max, Math.max(min, Math.round(n)));
    onChange(clamped);
    setDraft(String(clamped));
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.numLbl}>{label}</Text>
      <View style={[styles.numWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          value={draft}
          onChangeText={(v) => setDraft(v.replace(/[^\d]/g, ""))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit(draft);
          }}
          keyboardType="number-pad"
          style={[styles.numInput, { color: colors.foreground }]}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: "800" },
  hint: { fontSize: 12, lineHeight: 17, color: "#6B7289" },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: "800" },
  rowBetween: { flexDirection: "row", alignItems: "center" },
  two: { flexDirection: "row", gap: 10 },
  oval: {
    minWidth: 72,
    minHeight: 36,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  ovalOn: { backgroundColor: EMERALD },
  ovalOff: { backgroundColor: "#EEF0F5" },
  ovalTxt: { fontWeight: "800", fontSize: 13 },
  numLbl: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8B90A0",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  numWrap: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  numInput: { flex: 1, fontSize: 15, fontWeight: "700", height: 44 },
  suffix: { fontWeight: "700", color: "#8B90A0", fontSize: 13 },
  save: {
    height: 50,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: NAVY,
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  saved: { textAlign: "center", color: EMERALD, fontWeight: "700", fontSize: 12 },
});
