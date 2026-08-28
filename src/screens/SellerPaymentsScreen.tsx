import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BadgeCheck,
  Banknote,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react-native";
import { OverlayHeader } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import {
  fetchConnectStatus,
  openConnectUrl,
  openConnectWebFallback,
  startConnectOnboarding,
  type ConnectStatus,
} from "../lib/stripe-connect";
import { GOLD, NAVY } from "../theme";

export function SellerPaymentsScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ConnectStatus>("none");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetchConnectStatus();
    setStatus(r.status);
    setError(r.ok ? null : r.message || r.error || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onboard = async () => {
    setBusy(true);
    setError(null);
    const res = await startConnectOnboarding(user?.country);
    setBusy(false);
    if (res.url) {
      await openConnectUrl(res.url);
      void refresh();
      return;
    }
    setError(res.error ?? null);
  };

  const badge =
    status === "active"
      ? { icon: <BadgeCheck size={18} color="#34d399" />, color: "#34d399", label: "Compte vendeur actif" }
      : status === "restricted"
        ? { icon: <TriangleAlert size={18} color="#f59e0b" />, color: "#f59e0b", label: "Action requise" }
        : status === "pending"
          ? { icon: <ActivityIndicator size={14} color={GOLD} />, color: GOLD, label: "Vérification en cours" }
          : { icon: <Banknote size={18} color={GOLD} />, color: GOLD, label: "Non configuré" };

  const steps = [
    "Crée ton compte vendeur sécurisé Stripe.",
    "Vérifie ton identité et ajoute ton compte bancaire.",
    "Reçois tes ventes automatiquement — KiDi+ garde 10 % de commission.",
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title="Configurer les paiements" />
      <ScrollView contentContainerStyle={styles.body}>
        <SurfaceCard>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={GOLD} />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>Vérification…</Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              {badge.icon}
              <Text style={[styles.statusLabel, { color: badge.color }]}>{badge.label}</Text>
            </View>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <View style={styles.stepsHeader}>
            <ShieldCheck size={16} color={GOLD} />
            <Text style={[styles.stepsTitle, { color: colors.foreground }]}>Comment ça marche</Text>
          </View>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>{s}</Text>
            </View>
          ))}
        </SurfaceCard>

        {status !== "active" && (
          <Press onPress={() => void onboard()} style={styles.goldBtn}>
            {busy ? (
              <ActivityIndicator size={16} color={NAVY} />
            ) : (
              <Text style={styles.goldBtnText}>
                {status === "none" ? "Configurer mon compte vendeur" : "Reprendre la configuration"}
              </Text>
            )}
          </Press>
        )}

        {status === "active" && (
          <Press onPress={() => void onboard()} style={styles.goldBtn}>
            <ExternalLink size={16} color={NAVY} />
            <Text style={styles.goldBtnText}>Ouvrir mon tableau de bord Stripe</Text>
          </Press>
        )}

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errTxt}>{error}</Text>
            <Press onPress={() => void openConnectWebFallback()} style={styles.webBtn}>
              <ExternalLink size={14} color={NAVY} />
              <Text style={styles.goldBtnText}>Configurer sur kidiplus.com</Text>
            </Press>
          </View>
        ) : null}

        <Press onPress={() => void refresh()} style={[styles.refreshBtn, { borderColor: colors.border }]}>
          <RefreshCw size={15} color={colors.mutedForeground} />
          <Text style={[styles.refreshText, { color: colors.mutedForeground }]}>Actualiser le statut</Text>
        </Press>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 14, paddingBottom: 48 },
  center: { alignItems: "center", gap: 8, paddingVertical: 12 },
  hint: { fontSize: 13 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  statusLabel: { fontSize: 15, fontWeight: "700" },
  stepsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  stepsTitle: { fontSize: 14, fontWeight: "700" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(232,185,59,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontSize: 11, fontWeight: "800", color: GOLD },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18 },
  goldBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  goldBtnText: { color: NAVY, fontSize: 15, fontWeight: "800" },
  errBox: {
    backgroundColor: "#FDE8E8",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  errTxt: { color: "#9B1C1C", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  webBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshBtn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshText: { fontSize: 14, fontWeight: "600" },
});
