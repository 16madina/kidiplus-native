import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BadgeCheck,
  Banknote,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { requireOptionalNativeModule } from "expo-modules-core";
import { OverlayHeader } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { supabase } from "../lib/supabase";
import { GOLD, NAVY } from "../theme";

async function openUrl(url: string) {
  if (requireOptionalNativeModule("ExpoWebBrowser")) {
    try {
      const WebBrowser = require("expo-web-browser") as typeof import("expo-web-browser");
      await WebBrowser.openBrowserAsync(url);
      return;
    } catch { /* fall through */ }
  }
  await Linking.openURL(url);
}

type ConnectStatus = "none" | "pending" | "active" | "restricted";

async function fetchConnectStatus(): Promise<{
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  status: ConnectStatus;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { connected: false, chargesEnabled: false, payoutsEnabled: false, status: "none" };
  try {
    const res = await fetch("https://kidiplus.com/api/connect/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) return { connected: false, chargesEnabled: false, payoutsEnabled: false, status: "none" };
    const json = await res.json();
    const status: ConnectStatus = json.chargesEnabled && json.payoutsEnabled
      ? "active"
      : json.connected
        ? "pending"
        : "none";
    return { ...json, status };
  } catch {
    return { connected: false, chargesEnabled: false, payoutsEnabled: false, status: "none" };
  }
}

async function startOnboarding(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const res = await fetch("https://kidiplus.com/api/connect/onboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.url ?? null;
  } catch {
    return null;
  }
}

export function SellerPaymentsScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ConnectStatus>("none");

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetchConnectStatus();
    setStatus(r.status);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onboard = async () => {
    setBusy(true);
    const url = await startOnboarding();
    setBusy(false);
    if (url) {
      await openUrl(url);
      void refresh();
    }
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
    gap: 8,
  },
  goldBtnText: { color: NAVY, fontSize: 15, fontWeight: "800" },
  refreshBtn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
  },
  refreshText: { fontSize: 14, fontWeight: "600" },
});
