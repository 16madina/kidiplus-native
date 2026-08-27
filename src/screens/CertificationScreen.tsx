import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { BadgeCheck, Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { GoldButton } from "../components/Buttons";
import { FormField } from "../components/FormField";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import {
  fetchEligibility,
  fetchIsVerified,
  fetchMyLatestVerification,
  submitVerificationRequest,
  type Eligibility,
  type VerificationRequestRow,
} from "../lib/verification";
import { GOLD } from "../theme";

export function CertificationScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [latest, setLatest] = useState<VerificationRequestRow | null>(null);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const id = user?.id;
    if (!id) return;
    let alive = true;
    void Promise.all([fetchEligibility(id), fetchMyLatestVerification(id), fetchIsVerified(id)]).then(
      ([e, r, v]) => {
        if (!alive) return;
        setElig(e);
        setLatest(r);
        setVerified(v);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const submit = async () => {
    setBusy(true);
    const res = await submitVerificationRequest(message);
    setBusy(false);
    if (!res.ok) {
      flash(res.error || t("verify.submitError"));
      return;
    }
    flash(t("verify.submitted"));
    setLatest({
      id: "local",
      user_id: user?.id ?? "",
      message: message || null,
      status: "pending",
      note: null,
      created_at: new Date().toISOString(),
    });
  };

  const pending = latest?.status === "pending";

  const criteria: Array<{ label: string; ok: boolean }> = elig
    ? [
        { label: t("verify.crit.seller"), ok: elig.is_seller },
        { label: `${t("verify.crit.sales")} (${elig.sales_count})`, ok: elig.sales_ok },
        { label: t("verify.crit.rating"), ok: elig.rating_ok },
        { label: `${t("verify.crit.age")} (${elig.age_days} j)`, ok: elig.age_ok },
        { label: t("verify.crit.noSanction"), ok: elig.no_sanction },
      ]
    : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("verify.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
        ) : verified ? (
          <SurfaceCard style={{ borderColor: GOLD, backgroundColor: "rgba(232,185,59,0.08)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <BadgeCheck size={22} color={GOLD} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: colors.foreground }}>{t("verify.youAreVerified")}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  {t("verify.verifiedHint")}
                </Text>
              </View>
            </View>
          </SurfaceCard>
        ) : (
          <>
            <Text style={[styles.section, { color: colors.mutedForeground }]}>
              {t("verify.criteria").toUpperCase()}
            </Text>
            <SurfaceCard padded={false}>
              {criteria.map((c, i) => (
                <View
                  key={c.label}
                  style={[styles.critRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  {c.ok ? <Check size={16} color="#1B7A3A" /> : <X size={16} color="#C0392B" />}
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: colors.foreground }}>{c.label}</Text>
                </View>
              ))}
            </SurfaceCard>
            {pending ? (
              <SurfaceCard>
                <Text style={{ fontWeight: "800", color: colors.foreground }}>{t("verify.pending")}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  {t("verify.pendingHint")}
                </Text>
              </SurfaceCard>
            ) : (
              <>
                {latest?.status === "rejected" && latest.note ? (
                  <SurfaceCard style={{ borderColor: "rgba(198,40,40,0.4)" }}>
                    <Text style={{ color: "#C0392B", fontWeight: "700", fontSize: 13 }}>
                      {t("verify.rejected")} — {latest.note}
                    </Text>
                  </SurfaceCard>
                ) : null}
                <FormField
                  label={t("verify.messagePlaceholder")}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={300}
                />
                <GoldButton
                  label={busy ? t("common.loading") : t("verify.submit")}
                  onPress={() => void submit()}
                  disabled={busy}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  section: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  critRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 46,
  },
});
