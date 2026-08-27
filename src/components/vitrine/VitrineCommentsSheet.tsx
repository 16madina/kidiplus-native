import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Send, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../Press";
import { useAppTheme } from "../../context/theme";
import {
  addVitrineComment,
  fetchVitrineComments,
  type VitrineComment,
} from "../../lib/vitrine";
import { GOLD, NAVY, initials } from "../../theme";
import { isHttpUrl } from "../../lib/storage";

export function VitrineCommentsSheet({
  postId,
  open,
  onClose,
  onCountChange,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<VitrineComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void fetchVitrineComments(postId).then((r) => {
      setRows(r);
      setLoading(false);
      onCountChange?.(r.length);
    });
  }, [open, postId, onCountChange]);

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await addVitrineComment(postId, text);
    setSending(false);
    if (!res.ok) return;
    setBody("");
    setRows((prev) => [...prev, res.comment]);
    onCountChange?.(rows.length + 1);
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Press haptic="none" onPress={onClose} style={styles.dim} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.head}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t("vitrine.comments", { defaultValue: "Commentaires" })}
              </Text>
              <Press onPress={onClose} style={styles.close}>
                <X size={18} color={colors.foreground} />
              </Press>
            </View>
            {loading ? (
              <ActivityIndicator color={GOLD} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 360 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}
                ListEmptyComponent={
                  <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 20 }}>
                    {t("vitrine.noComments", { defaultValue: "Aucun commentaire." })}
                  </Text>
                }
                renderItem={({ item }) => (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {isHttpUrl(item.authorAvatar) ? (
                      <Image source={{ uri: item.authorAvatar }} style={styles.av} />
                    ) : (
                      <View style={[styles.av, { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{initials(item.authorName)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "800", color: colors.foreground, fontSize: 13 }}>{item.authorName}</Text>
                      <Text style={{ color: colors.foreground, marginTop: 2 }}>{item.body}</Text>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={[styles.composer, { borderTopColor: colors.border }]}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={t("vitrine.commentPlaceholder", { defaultValue: "Ajouter un commentaire…" })}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                maxLength={1000}
              />
              <Press onPress={() => void send()} disabled={sending || !body.trim()} style={[styles.send, { opacity: body.trim() ? 1 : 0.4 }]}>
                {sending ? <ActivityIndicator color={NAVY} /> : <Send size={16} color={NAVY} />}
              </Press>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  dim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, maxHeight: "78%" },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: "800" },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  av: { width: 32, height: 32, borderRadius: 16 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  send: {
    width: 40,
    height: 40,
    minWidth: 40,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
});
