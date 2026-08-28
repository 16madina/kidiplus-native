import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Star, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { useAppTheme } from "../../context/theme";
import { getMyReviewForOrder, leaveReview } from "../../lib/reviews";
import { GOLD, NAVY } from "../../theme";

export function LeaveReviewSheet({
  open,
  orderId,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    setError(null);
    void getMyReviewForOrder(orderId).then((r) => {
      if (r) {
        setRating(r.rating);
        setComment(r.comment ?? "");
        setExisting(true);
      } else {
        setRating(5);
        setComment("");
        setExisting(false);
      }
    });
  }, [open, orderId]);

  const submit = async () => {
    if (!orderId || saving) return;
    setSaving(true);
    setError(null);
    const res = await leaveReview(orderId, rating, comment);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? t("errors.generic", { defaultValue: "Erreur" }));
      return;
    }
    onSubmitted?.();
    onClose();
  };

  return (
    <Modal visible={open && !!orderId} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Press style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {existing ? t("reviews.edit") : t("reviews.leave")}
            </Text>
            <Press onPress={onClose} style={styles.close}>
              <X size={20} color={colors.foreground} />
            </Press>
          </View>
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginBottom: 12 }}>
            {t("reviews.rate")}
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Press key={n} onPress={() => setRating(n)} style={styles.starBtn}>
                <Star size={30} color={n <= rating ? GOLD : colors.border} fill={n <= rating ? GOLD : "transparent"} />
              </Press>
            ))}
          </View>
          <TextInput
            value={comment}
            onChangeText={(v) => setComment(v.slice(0, 400))}
            placeholder={t("reviews.commentPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
          />
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Press onPress={() => void submit()} disabled={saving} style={styles.cta}>
            {saving ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.ctaTxt}>{existing ? t("common.save") : t("reviews.submit")}</Text>
            )}
          </Press>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: "800" },
  close: { minHeight: 36, minWidth: 36 },
  stars: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 },
  starBtn: { minHeight: 44, minWidth: 44 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  err: { color: "#C0392B", fontSize: 12, fontWeight: "700", marginTop: 8 },
  cta: { marginTop: 16, height: 50, borderRadius: 16, backgroundColor: GOLD },
  ctaTxt: { color: NAVY, fontWeight: "800", fontSize: 16 },
});
