import { StyleSheet, Text, View } from "react-native";
import {
  ShoppingBag,
  CreditCard,
  Truck,
  PackageCheck,
  AlertTriangle,
} from "lucide-react-native";
import { useAppTheme } from "../../context/theme";
import { GOLD, NAVY } from "../../theme";

type TimelineStep = {
  key: string;
  label: string;
  date?: string | null;
  completed: boolean;
  active: boolean;
};

const STEP_META: Record<string, { icon: typeof ShoppingBag; color: string }> = {
  created: { icon: ShoppingBag, color: "#6366f1" },
  paid: { icon: CreditCard, color: "#2563eb" },
  shipped: { icon: Truck, color: GOLD },
  delivered: { icon: PackageCheck, color: "#16a34a" },
  disputed: { icon: AlertTriangle, color: "#dc2626" },
};

function buildSteps(status: string, createdAt?: string, paidAt?: string, shippedAt?: string, deliveredAt?: string): TimelineStep[] {
  const statuses = ["created", "paid", "shipped", "delivered"];
  const dates: Record<string, string | null> = {
    created: createdAt ?? null,
    paid: paidAt ?? null,
    shipped: shippedAt ?? null,
    delivered: deliveredAt ?? null,
  };
  const labels: Record<string, string> = {
    created: "Commandé",
    paid: "Payé",
    shipped: "Expédié",
    delivered: "Livré",
    disputed: "Litige",
  };

  if (status === "disputed") {
    const idx = statuses.indexOf("delivered");
    statuses.splice(idx, 1, "disputed");
  }

  const currentIdx = statuses.indexOf(status === "disputed" ? "disputed" : status);
  return statuses.map((s, i) => ({
    key: s,
    label: labels[s] ?? s,
    date: dates[s] ?? null,
    completed: i < currentIdx,
    active: i === currentIdx,
  }));
}

export function OrderTimeline({
  status,
  createdAt,
  paidAt,
  shippedAt,
  deliveredAt,
}: {
  status: string;
  createdAt?: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
}) {
  const { colors } = useAppTheme();
  const steps = buildSteps(status, createdAt, paidAt, shippedAt, deliveredAt);

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      {steps.map((step, i) => {
        const meta = STEP_META[step.key] ?? STEP_META.created;
        const Icon = meta.icon;
        const dotColor = step.completed || step.active ? meta.color : colors.muted;
        const isLast = i === steps.length - 1;
        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.dotCol}>
              <View style={[styles.dot, { backgroundColor: dotColor }]}>
                <Icon size={12} color="#fff" />
              </View>
              {!isLast && (
                <View style={[styles.line, { backgroundColor: step.completed ? meta.color : colors.border }]} />
              )}
            </View>
            <View style={styles.content}>
              <Text style={[styles.label, { color: step.active ? colors.foreground : colors.mutedForeground }]}>
                {step.label}
              </Text>
              {step.date && (
                <Text style={[styles.date, { color: colors.mutedForeground }]}>{fmtDate(step.date)}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  row: { flexDirection: "row", minHeight: 48 },
  dotCol: { width: 32, alignItems: "center" },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { width: 2, flex: 1, marginVertical: 2, borderRadius: 1 },
  content: { flex: 1, paddingLeft: 10, paddingBottom: 12 },
  label: { fontSize: 14, fontWeight: "700" },
  date: { fontSize: 12, marginTop: 2 },
});
