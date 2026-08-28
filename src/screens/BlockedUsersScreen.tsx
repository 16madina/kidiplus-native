import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { OverlayHeader } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAppTheme } from "../context/theme";
import { listMyBlocks, unblockUser, type BlockedRow } from "../lib/moderation";
import { GOLD } from "../theme";

export function BlockedUsersScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyBlocks();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnblock = async (blockedId: string) => {
    setUnblocking((prev) => new Set(prev).add(blockedId));
    const res = await unblockUser(blockedId);
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.blocked_id !== blockedId));
    }
    setUnblocking((prev) => {
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });
  };

  const renderItem = ({ item }: { item: BlockedRow }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Image
        source={item.avatar_url ? { uri: item.avatar_url } : require("../../assets/icon.png")}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {item.display_name || item.handle}
        </Text>
        {item.handle ? (
          <Text style={[styles.handle, { color: colors.mutedForeground }]}>@{item.handle}</Text>
        ) : null}
      </View>
      <Press
        onPress={() => void handleUnblock(item.blocked_id)}
        disabled={unblocking.has(item.blocked_id)}
        style={[styles.btn, { opacity: unblocking.has(item.blocked_id) ? 0.5 : 1 }]}
      >
        {unblocking.has(item.blocked_id) ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.btnText}>
            {t("blocked.unblock", { defaultValue: "Débloquer" })}
          </Text>
        )}
      </Press>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("blocked.title", { defaultValue: "Utilisateurs bloqués" })} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            {t("blocked.empty", { defaultValue: "Aucun utilisateur bloqué" })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.blocked_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { fontSize: 15, textAlign: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 48 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1a1a2e" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700" },
  handle: { fontSize: 13, marginTop: 2 },
  btn: {
    backgroundColor: "#C0392B",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
