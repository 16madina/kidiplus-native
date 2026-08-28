import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FileText } from "lucide-react-native";
import { OverlayHeader } from "../OverlayHeader";
import { SurfaceCard } from "../SurfaceCard";
import { useAppTheme } from "../../context/theme";
import { GOLD, NAVY } from "../../theme";

type InvoiceOrder = {
  id: string;
  item_name: string;
  amount: number;
  delivery_fee: number;
  total: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at?: string | null;
  seller_name?: string;
  buyer_name?: string;
};

function invoiceNumber(order: InvoiceOrder): string {
  const d = new Date(order.created_at);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `KD-${ymd}-${order.id.slice(0, 6).toUpperCase()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtMoney(n: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(n);
}

export function InvoiceSheet({
  order,
  visible,
  onClose,
}: {
  order: InvoiceOrder | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();

  if (!visible || !order) return null;

  const number = invoiceNumber(order);
  const isPaid = order.status === "paid" || order.status === "shipped" || order.status === "delivered";

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background }]}>
      <OverlayHeader title="Facture" onBack={onClose} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.ticket}>
          <View style={styles.ticketHeader}>
            <Text style={styles.ticketBrand}>KiDi+</Text>
            <View style={[styles.stamp, { borderColor: isPaid ? "#34d399" : "#f59e0b" }]}>
              <Text style={[styles.stampText, { color: isPaid ? "#34d399" : "#f59e0b" }]}>
                {isPaid ? "PAYÉE" : "EN ATTENTE"}
              </Text>
            </View>
          </View>

          <Text style={styles.invoiceLabel}>FACTURE</Text>
          <Text style={styles.invoiceNumber}>{number}</Text>
          <Text style={styles.invoiceDate}>{fmtDate(order.created_at)}</Text>

          <View style={styles.divider} />

          <Text style={styles.itemName}>{order.item_name}</Text>

          <View style={styles.partiesRow}>
            {order.seller_name && (
              <View style={styles.partyBox}>
                <Text style={styles.partyLabel}>Vendeur</Text>
                <Text style={styles.partyName}>{order.seller_name}</Text>
              </View>
            )}
            {order.buyer_name && (
              <View style={styles.partyBox}>
                <Text style={styles.partyLabel}>Acheteur</Text>
                <Text style={styles.partyName}>{order.buyer_name}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Article</Text>
            <Text style={styles.amountValue}>{fmtMoney(order.amount, order.currency)}</Text>
          </View>
          {order.delivery_fee > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Livraison</Text>
              <Text style={styles.amountValue}>{fmtMoney(order.delivery_fee, order.currency)}</Text>
            </View>
          )}
          <View style={[styles.amountRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{fmtMoney(order.total, order.currency)}</Text>
          </View>

          {isPaid && order.paid_at && (
            <Text style={styles.paidNote}>Payée le {fmtDate(order.paid_at)}</Text>
          )}

          <Text style={styles.orderId}>{order.id}</Text>
          <Text style={styles.thanks}>Merci pour ta confiance</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 100 },
  body: { padding: 16, paddingBottom: 48 },
  ticket: {
    backgroundColor: "#FDFCF9",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ticketBrand: { fontSize: 22, fontWeight: "900", color: NAVY },
  stamp: { borderWidth: 2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  stampText: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  invoiceLabel: { marginTop: 16, fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#9ca3af" },
  invoiceNumber: { fontSize: 18, fontWeight: "900", color: NAVY, marginTop: 2 },
  invoiceDate: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#E8E4D8", marginVertical: 16 },
  itemName: { fontSize: 15, fontWeight: "700", color: NAVY },
  partiesRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  partyBox: { flex: 1, backgroundColor: "#F4F2EC", borderRadius: 12, padding: 10 },
  partyLabel: { fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase" },
  partyName: { fontSize: 13, fontWeight: "700", color: NAVY, marginTop: 4 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  amountLabel: { fontSize: 13, color: "#6b7280" },
  amountValue: { fontSize: 13, fontWeight: "600", color: NAVY },
  totalRow: { borderTopWidth: 1, borderTopColor: "#E8E4D8", paddingTop: 10, marginTop: 8 },
  totalLabel: { fontSize: 13, fontWeight: "800", color: NAVY },
  totalValue: { fontSize: 20, fontWeight: "900", color: NAVY },
  paidNote: { fontSize: 12, color: "#6b7280", marginTop: 12 },
  orderId: { fontSize: 10, color: "#c2beb2", marginTop: 12 },
  thanks: { fontSize: 12, fontWeight: "600", color: "#9ca3af", textAlign: "center", marginTop: 16 },
});
