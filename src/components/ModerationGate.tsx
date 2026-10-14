import { useEffect, useState, type ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Press } from "./Press";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/auth";
import { SUPPORT_CONTACT_EMAIL } from "../lib/legal-content";
import { NAVY } from "../theme";

type ModerationStatus = "banned" | "suspended" | null;
type GateState = {
  status: ModerationStatus;
  reason?: string | null;
  suspendedUntil?: string | null;
};

export function ModerationGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [gate, setGate] = useState<GateState>({ status: null });
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user) {
      setGate({ status: null });
      return;
    }
    let cancelled = false;

    async function check() {
      // Same RPC as the website. The reason and end date live in user_sanctions,
      // not on profiles (selecting them there fails with a 400).
      const { data } = await supabase.rpc("my_moderation_state");
      if (cancelled) return;
      const state = data as {
        status?: string;
        active_sanction?: { reason?: string | null; expires_at?: string | null } | null;
      } | null;
      if (state?.status === "banned") {
        setGate({ status: "banned", reason: state.active_sanction?.reason });
      } else if (state?.status === "suspended") {
        setGate({
          status: "suspended",
          reason: state.active_sanction?.reason,
          suspendedUntil: state.active_sanction?.expires_at,
        });
      } else {
        setGate({ status: null });
      }
    }

    void check();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [user]);

  if (gate.status === "banned") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.emoji}>🚫</Text>
        <Text style={styles.title}>Ton compte a été banni</Text>
        {gate.reason ? <Text style={styles.reason}>{gate.reason}</Text> : null}
        <Text style={styles.body}>
          Si tu penses qu'il s'agit d'une erreur, contacte notre support.
        </Text>
        <Press
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_CONTACT_EMAIL}`)}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Contacter le support</Text>
        </Press>
      </View>
    );
  }

  if (gate.status === "suspended") {
    const until = gate.suspendedUntil
      ? new Date(gate.suspendedUntil).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.emoji}>⏸️</Text>
        <Text style={styles.title}>Ton compte est temporairement suspendu</Text>
        {until ? <Text style={styles.reason}>Jusqu'au {until}</Text> : null}
        {gate.reason ? <Text style={styles.reason}>{gate.reason}</Text> : null}
        <Text style={styles.body}>
          Si tu penses qu'il s'agit d'une erreur, contacte notre support.
        </Text>
        <Press
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_CONTACT_EMAIL}`)}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Contacter le support</Text>
        </Press>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 12 },
  reason: { fontSize: 15, color: "#ccc", textAlign: "center", marginBottom: 8 },
  body: { fontSize: 14, color: "#999", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  btn: {
    backgroundColor: "#E74C3C",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
