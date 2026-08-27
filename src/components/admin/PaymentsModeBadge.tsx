import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

type Report = {
  effective: "test" | "live";
  stripe: { gatewayEnv: "sandbox" | "live" };
  paypal: { mode: "sandbox" | "live" };
};

export function PaymentsModeBadge() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch("https://kidiplus.com/api/admin/payments-mode", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const j = (await res.json()) as Report & { ok?: boolean };
        if (alive && j?.effective) setReport(j);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!report) return null;
  const live = report.effective === "live";
  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, live ? styles.live : styles.test]}>
        <View style={[styles.dot, { backgroundColor: live ? "#C62828" : "#059669" }]} />
        <Text style={[styles.pillTxt, { color: live ? "#C62828" : "#059669" }]}>
          {live ? "Mode production" : "Mode test"}
        </Text>
      </View>
      <Text style={styles.meta}>
        Stripe {report.stripe.gatewayEnv} · PayPal {report.paypal.mode}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  live: { backgroundColor: "rgba(198,40,40,0.1)" },
  test: { backgroundColor: "rgba(5,150,105,0.1)" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  meta: { fontSize: 10, color: "#8B90A0", fontWeight: "600" },
});
