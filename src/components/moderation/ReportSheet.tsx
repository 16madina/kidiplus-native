// ReportSheet — reason picker + optional note (Apple 1.2 / web parity).
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";
import { Press } from "../Press";
import { useAppTheme } from "../../context/theme";
import {
  submitReport,
  type ReportReason,
  type ReportTargetType,
} from "../../lib/moderation";
import { GOLD, NAVY } from "../../theme";

const REASONS: ReportReason[] = ["inappropriate", "fraud", "counterfeit", "harassment", "other"];

export function ReportSheet({
  open,
  onClose,
  targetType,
  targetId,
  defaultReason,
  defaultNote,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  defaultReason?: ReportReason;
  defaultNote?: string;
  onSent?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(defaultReason ?? null);
  const [note, setNote] = useState(defaultNote ?? "");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(defaultReason ?? null);
      setNote(defaultNote ?? "");
      setBusy(false);
      setToast(null);
    }
  }, [open, defaultReason, defaultNote]);

  const submit = async () => {
    if (busy) return;
    if (!reason) {
      setToast(t("report.pickReason"));
      return;
    }
    const id = (targetId ?? "").trim();
    if (!id) {
      setToast(t("report.failed"));
      return;
    }
    setBusy(true);
    const r = await submitReport({
      targetType,
      targetId: id,
      reason,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (r.ok) {
      setToast(t("report.sent"));
      onSent?.();
      setTimeout(() => onClose(), 600);
    } else {
      setToast(r.error === "unauthorized" ? t("auth.errors.notSignedIn", { defaultValue: "Connecte-toi." }) : t("report.failed"));
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 16),
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {targetType === "live" ? t("report.titleLive") : t("report.title")}
          </Text>
          <Press onPress={onClose} style={styles.closeBtn}>
            <X size={18} color={colors.foreground} />
          </Press>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 12 }}>
          {t("report.subtitle")}
        </Text>
        <View style={{ gap: 8 }}>
          {REASONS.map((r) => {
            const on = reason === r;
            return (
              <Press
                key={r}
                onPress={() => setReason(r)}
                style={[
                  styles.reason,
                  {
                    borderColor: on ? GOLD : colors.border,
                    backgroundColor: on ? "rgba(247,206,90,0.14)" : colors.card,
                  },
                ]}
              >
                <Text style={{ fontWeight: "700", color: colors.foreground }}>
                  {t(`report.reasons.${r}`)}
                </Text>
              </Press>
            );
          })}
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t("report.notePh")}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.note,
            { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground },
          ]}
        />
        <Press onPress={() => void submit()} disabled={busy} style={[styles.submit, { opacity: busy ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color={NAVY} /> : null}
          <Text style={styles.submitTxt}>{t("report.submit")}</Text>
        </Press>
        {toast ? (
          <Text style={{ textAlign: "center", marginTop: 10, color: colors.mutedForeground, fontWeight: "600" }}>
            {toast}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.35)",
    marginBottom: 10,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 17, fontWeight: "800" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  reason: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  note: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: "top",
    fontSize: 14,
  },
  submit: {
    marginTop: 14,
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitTxt: { color: NAVY, fontWeight: "800", fontSize: 15 },
});
