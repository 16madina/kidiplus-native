import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, Reply, Send, SmilePlus, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../Press";
import { useAppTheme } from "../../context/theme";
import {
  addVitrineComment,
  fetchVitrineComments,
  type VitrineComment,
} from "../../lib/vitrine";
import { supabase } from "../../lib/supabase";
import { GOLD, NAVY, initials } from "../../theme";
import { isHttpUrl } from "../../lib/storage";

const QUICK_EMOJIS = ["❤️", "🔥", "😍", "👏", "😂", "💯", "🙌", "✨"];

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
  const [replyTo, setReplyTo] = useState<VitrineComment | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setReplyTo(null);
    void fetchVitrineComments(postId).then((r) => {
      setRows(r);
      setLoading(false);
      onCountChange?.(r.length);
    });
    void loadLikedComments(postId).then(setLikedIds);
  }, [open, postId, onCountChange]);

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await addVitrineComment(postId, text, replyTo?.id);
    setSending(false);
    if (!res.ok) return;
    setBody("");
    setReplyTo(null);
    setRows((prev) => [...prev, res.comment]);
    onCountChange?.(rows.length + 1);
  };

  const toggleLike = async (commentId: string) => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const wasLiked = likedIds.has(commentId);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    if (wasLiked) {
      await supabase.from("vitrine_comment_likes").delete().eq("comment_id", commentId).eq("user_id", uid);
    } else {
      await supabase.from("vitrine_comment_likes").insert({ comment_id: commentId, user_id: uid });
    }
  };

  const handleReply = (comment: VitrineComment) => {
    setReplyTo(comment);
    setBody(`@${comment.authorName} `);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setBody((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  if (!open) return null;

  const grouped = groupReplies(rows);

  return (
    <View style={styles.root}>
      <Press haptic="none" onPress={onClose} style={styles.dim} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={styles.kavWrap}
      >
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t("vitrine.comments", "Commentaires")}
            </Text>
            <Press onPress={onClose} style={styles.close}>
              <X size={18} color={colors.foreground} />
            </Press>
          </View>
          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={grouped}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 380 }}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 20 }}>
                  {t("vitrine.noComments", "Aucun commentaire.")}
                </Text>
              }
              renderItem={({ item }) => (
                <CommentRow
                  comment={item}
                  liked={likedIds.has(item.id)}
                  onLike={() => void toggleLike(item.id)}
                  onReply={() => handleReply(item)}
                  colors={colors}
                  indent={!!item.parentId}
                />
              )}
            />
          )}
          {replyTo ? (
            <View style={[styles.replyBanner, { backgroundColor: colors.card }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1 }}>
                ↪ {t("vitrine.replyingTo", "Réponse à")} {replyTo.authorName}
              </Text>
              <Press onPress={() => { setReplyTo(null); setBody(""); }} style={{ minHeight: 28, minWidth: 28 }}>
                <X size={14} color={colors.mutedForeground} />
              </Press>
            </View>
          ) : null}
          <View style={styles.emojiRow}>
            {QUICK_EMOJIS.map((e) => (
              <Press key={e} onPress={() => insertEmoji(e)} style={styles.emojiBtn}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Press>
            ))}
          </View>
          <View style={[styles.composer, { borderTopColor: colors.border }]}>
            <TextInput
              ref={inputRef}
              value={body}
              onChangeText={setBody}
              placeholder={replyTo
                ? t("vitrine.replyPlaceholder", "Répondre…")
                : t("vitrine.commentPlaceholder", "Ajouter un commentaire…")}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
            <Press onPress={() => void send()} disabled={sending || !body.trim()} style={[styles.send, { opacity: body.trim() ? 1 : 0.4 }]}>
              {sending ? <ActivityIndicator color={NAVY} /> : <Send size={16} color={NAVY} />}
            </Press>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function CommentRow({
  comment,
  liked,
  onLike,
  onReply,
  colors,
  indent,
}: {
  comment: VitrineComment;
  liked: boolean;
  onLike: () => void;
  onReply: () => void;
  colors: { foreground: string; mutedForeground: string };
  indent: boolean;
}) {
  return (
    <View style={[{ flexDirection: "row", gap: 10 }, indent && { marginLeft: 36 }]}>
      {isHttpUrl(comment.authorAvatar) ? (
        <Image source={{ uri: comment.authorAvatar }} style={styles.av} />
      ) : (
        <View style={[styles.av, { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{initials(comment.authorName)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", color: colors.foreground, fontSize: 13 }}>{comment.authorName}</Text>
        <Text style={{ color: colors.foreground, marginTop: 2, fontSize: 13, lineHeight: 18 }}>{comment.body}</Text>
        <View style={styles.cmtActions}>
          <Press onPress={onReply} style={styles.cmtBtn}>
            <Reply size={13} color={colors.mutedForeground} />
            <Text style={[styles.cmtBtnTxt, { color: colors.mutedForeground }]}>Répondre</Text>
          </Press>
          <Press onPress={onLike} style={styles.cmtBtn}>
            <Heart size={13} color={liked ? "#FF3B5C" : colors.mutedForeground} fill={liked ? "#FF3B5C" : "none"} />
          </Press>
        </View>
      </View>
    </View>
  );
}

function groupReplies(rows: VitrineComment[]): VitrineComment[] {
  const top = rows.filter((r) => !r.parentId);
  const childrenMap = new Map<string, VitrineComment[]>();
  for (const r of rows) {
    if (r.parentId) {
      const arr = childrenMap.get(r.parentId) ?? [];
      arr.push(r);
      childrenMap.set(r.parentId, arr);
    }
  }
  const result: VitrineComment[] = [];
  for (const parent of top) {
    result.push(parent);
    const children = childrenMap.get(parent.id);
    if (children) result.push(...children);
  }
  return result;
}

async function loadLikedComments(postId: string): Promise<Set<string>> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return new Set();
  const { data } = await supabase
    .from("vitrine_comment_likes")
    .select("comment_id")
    .eq("user_id", uid);
  return new Set((data ?? []).map((r) => (r as { comment_id: string }).comment_id));
}

export async function shareVitrinePost(postId: string, caption: string) {
  const url = `https://kidiplus.com/vitrine/${postId}`;
  try {
    await Share.share({
      message: caption ? `${caption}\n${url}` : url,
      url,
    });
  } catch {
    /* user cancelled */
  }
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  dim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  kavWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 6, maxHeight: "80%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(100,100,100,0.4)", marginBottom: 8 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: "800" },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  av: { width: 30, height: 30, borderRadius: 15 },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  emojiRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  emojiBtn: { minHeight: 32, minWidth: 32, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(100,100,100,0.12)" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
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
  cmtActions: { flexDirection: "row", gap: 12, marginTop: 6, alignItems: "center" },
  cmtBtn: { flexDirection: "row", gap: 4, minHeight: 24, minWidth: 24 },
  cmtBtnTxt: { fontSize: 11, fontWeight: "600" },
});
