import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Press } from "./Press";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/auth";
import { GOLD } from "../theme";

export function EmailConfirmBanner() {
  const { user } = useAuth();
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!user) {
      setNeedsConfirm(false);
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user && !data.user.email_confirmed_at) {
        setNeedsConfirm(true);
      } else {
        setNeedsConfirm(false);
      }
    });
  }, [user]);

  const handleResend = useCallback(async () => {
    if (!user?.email || sending) return;
    setSending(true);
    try {
      await supabase.auth.resend({ type: "signup", email: user.email });
      setSent(true);
    } finally {
      setSending(false);
    }
  }, [user?.email, sending]);

  if (!needsConfirm) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text} numberOfLines={2}>
        {sent
          ? "Email de confirmation renvoyé ✓"
          : "Confirme ton email pour vendre et retirer"}
      </Text>
      {!sent ? (
        <Press onPress={() => void handleResend()} style={styles.btn} disabled={sending}>
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnText}>Renvoyer</Text>
          )}
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  text: { flex: 1, fontSize: 13, fontWeight: "700", color: "#000" },
  btn: {
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
