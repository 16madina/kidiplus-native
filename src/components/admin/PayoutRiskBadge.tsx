import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import {
  adminFreezeUser,
  adminUnfreezeUser,
  fetchPayoutRisk,
  type PayoutRisk,
} from "../../lib/admin";

const LEVEL: Record<PayoutRisk["level"], { bg: string; fg: string; emoji: string }> = {
  green: { bg: "rgba(27,122,58,0.12)", fg: "#1B7A3A", emoji: "🟢" },
  yellow: { bg: "rgba(180,83,9,0.15)", fg: "#B45309", emoji: "🟡" },
  red: { bg: "rgba(192,57,43,0.15)", fg: "#C0392B", emoji: "🔴" },
};

export function PayoutRiskBadge({
  payoutId,
  sellerId,
  onChanged,
}: {
  payoutId: string;
  sellerId?: string | null;
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const [risk, setRisk] = useState<PayoutRisk | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchPayoutRisk(payoutId).then(setRisk);
  }, [payoutId]);

  if (!risk) return null;
  const s = LEVEL[risk.level] ?? LEVEL.green;

  const freeze = () => {
    if (!sellerId) return;
    Alert.prompt
      ? Alert.prompt(t("admin.risk.freezePrompt"), undefined, async (reason) => {
          if (reason == null) return;
          setBusy(true);
          const r = await adminFreezeUser(sellerId, reason);
          setBusy(false);
          if (!r.ok) return;
          setRisk(await fetchPayoutRisk(payoutId));
          onChanged?.();
        })
      : Alert.alert(t("admin.risk.freezePrompt"), undefined, [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("admin.risk.freeze"),
            style: "destructive",
            onPress: async () => {
              setBusy(true);
              const r = await adminFreezeUser(sellerId, "verification");
              setBusy(false);
              if (!r.ok) return;
              setRisk(await fetchPayoutRisk(payoutId));
              onChanged?.();
            },
          },
        ]);
  };

  return (
    <View style={[styles.box, { backgroundColor: s.bg }]}>
      <Text style={{ color: s.fg, fontWeight: "800", fontSize: 12 }}>
        {s.emoji} {t(`admin.risk.level.${risk.level}`)}
        {risk.is_frozen ? ` · ${t("admin.risk.frozen")}` : ""}
      </Text>
      {risk.signals.length === 0 ? (
        <Text style={styles.sig}>{t("admin.risk.noSignals")}</Text>
      ) : (
        risk.signals.map((sig) => (
          <Text key={sig.code} style={styles.sig}>
            · {sig.label}
          </Text>
        ))
      )}
      {sellerId ? (
        <Press
          disabled={busy}
          onPress={() => {
            if (risk.is_frozen) {
              setBusy(true);
              void adminUnfreezeUser(sellerId).then(async (r) => {
                setBusy(false);
                if (r.ok) {
                  setRisk(await fetchPayoutRisk(payoutId));
                  onChanged?.();
                }
              });
              return;
            }
            freeze();
          }}
          style={styles.btn}
        >
          {busy ? (
            <ActivityIndicator color={s.fg} />
          ) : (
            <Text style={{ color: s.fg, fontWeight: "800", fontSize: 12 }}>
              {risk.is_frozen ? t("admin.risk.unfreeze") : t("admin.risk.freezeFunds")}
            </Text>
          )}
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 8, borderRadius: 12, padding: 10, gap: 4 },
  sig: { fontSize: 11, color: "#374151", marginTop: 2 },
  btn: { alignSelf: "flex-start", minHeight: 32, marginTop: 6, paddingHorizontal: 10 },
});
