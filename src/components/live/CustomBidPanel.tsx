import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Gavel, Minus, Plus, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "../Press";
import { Glass } from "../Glass";
import {
  bidStepFor,
  formatMoney,
  maxBidAmount,
  parseBidAmount,
  roundForCurrency,
  type Currency,
} from "../../lib/money";
import { NAVY } from "../../theme";

export function CustomBidPanel({
  currentPrice,
  startPrice,
  currency,
  onConfirm,
  onClose,
  busy,
}: {
  currentPrice: number;
  startPrice: number;
  currency: Currency;
  onConfirm: (amount: number) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const step = useMemo(() => bidStepFor(currentPrice, currency), [currentPrice, currency]);
  const min = useMemo(
    () => roundForCurrency(currentPrice + step, currency),
    [currentPrice, step, currency],
  );
  const cap = useMemo(() => maxBidAmount(startPrice, currency), [startPrice, currency]);
  const [amount, setAmount] = useState(min);
  const [draft, setDraft] = useState(String(min));

  useEffect(() => {
    setAmount((prev) => Math.min(Math.max(prev, min), cap));
  }, [min, cap]);
  useEffect(() => {
    setAmount(min);
    setDraft(String(min));
  }, [min]);

  const commitDraft = () => {
    const parsed = parseBidAmount(draft, currency);
    if (parsed == null) {
      setDraft(String(amount));
      return;
    }
    const clamped = Math.min(Math.max(parsed, min), cap);
    setAmount(clamped);
    setDraft(String(clamped));
  };

  const bump = (dir: 1 | -1) => {
    setAmount((a) => {
      const next = roundForCurrency(a + dir * step, currency);
      const clamped = Math.min(Math.max(next, min), cap);
      setDraft(String(clamped));
      return clamped;
    });
  };

  const fmt = (n: number) => formatMoney(n, currency, i18n.language);

  return (
    <Glass tone="dark" intensity={48} radius={18} contentStyle={styles.pad}>
      <View style={styles.head}>
        <Text style={styles.title}>{t("bid.custom.title")}</Text>
        <Press onPress={onClose} style={styles.close} accessibilityLabel={t("bid.custom.close")}>
          <X size={14} color="rgba(255,255,255,0.75)" />
        </Press>
      </View>
      <View style={styles.row}>
        <Press
          onPress={() => bump(-1)}
          disabled={amount <= min}
          style={styles.step}
          accessibilityLabel={t("bid.custom.decrease")}
        >
          <Minus size={18} color="#fff" />
        </Press>
        <View style={styles.amountBox}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="decimal-pad"
            returnKeyType="done"
            style={styles.input}
            accessibilityLabel={t("bid.custom.editAmount")}
          />
          <Text style={styles.minHint}>
            {t("bid.custom.min")} {fmt(min)}
          </Text>
        </View>
        <Press
          onPress={() => bump(1)}
          disabled={amount >= cap}
          style={styles.step}
          accessibilityLabel={t("bid.custom.increase")}
        >
          <Plus size={18} color="#fff" />
        </Press>
      </View>
      <Press
        onPress={() => {
          commitDraft();
          const parsed = parseBidAmount(draft, currency) ?? amount;
          const clamped = Math.min(Math.max(parsed, min), cap);
          onConfirm(clamped);
        }}
        disabled={busy}
        style={styles.confirm}
      >
        <LinearGradient colors={["#F7CE5A", "#E8B93B", "#D9A73A"]} style={styles.confirmGrad}>
          <Gavel size={14} color={NAVY} />
          <Text style={styles.confirmTxt} numberOfLines={1}>
            {t("bid.custom.confirm", { amount: fmt(amount) })}
          </Text>
        </LinearGradient>
      </Press>
    </Glass>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  close: { width: 28, height: 28, minWidth: 28, minHeight: 28, borderRadius: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  step: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  amountBox: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  input: {
    width: "100%",
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 0,
    fontVariant: ["tabular-nums"],
  },
  minHint: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  confirm: { minHeight: 40, width: "100%", borderRadius: 12, overflow: "hidden" },
  confirmGrad: {
    height: 40,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
  },
  confirmTxt: { color: NAVY, fontWeight: "900", fontSize: 13 },
});
