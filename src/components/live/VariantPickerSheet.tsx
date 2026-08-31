import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { GOLD, NAVY } from "../../theme";

export function VariantPickerSheet({
  open,
  onClose,
  productName,
  colors,
  sizes,
  initialColor,
  initialSize,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  productName: string;
  colors: string[];
  sizes: string[];
  initialColor?: string;
  initialSize?: string;
  onConfirm: (v: { color?: string; size?: string }) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [color, setColor] = useState<string | undefined>(initialColor);
  const [size, setSize] = useState<string | undefined>(initialSize);

  useEffect(() => {
    if (!open) return;
    setColor(initialColor ?? (colors.length === 1 ? colors[0] : undefined));
    setSize(initialSize ?? (sizes.length === 1 ? sizes[0] : undefined));
  }, [open, initialColor, initialSize, colors, sizes]);

  const needColor = colors.length > 1;
  const needSize = sizes.length > 1;
  const canConfirm =
    (!needColor || !!color) &&
    (!needSize || !!size) &&
    (colors.length === 0 || !!color || colors.length === 1) &&
    (sizes.length === 0 || !!size || sizes.length === 1);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.back}>
        <Press haptic="none" onPress={onClose} style={{ flex: 1 }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{t("productOptions.pickVariant", "Choisis ta variante")}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {productName}
          </Text>
          {colors.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>{t("productOptions.colors", "Couleurs")}</Text>
              <View style={styles.row}>
                {colors.map((c) => {
                  const on = color === c;
                  return (
                    <Press key={c} onPress={() => setColor(c)} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c}</Text>
                    </Press>
                  );
                })}
              </View>
            </View>
          ) : null}
          {sizes.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>{t("productOptions.sizes", "Tailles")}</Text>
              <View style={styles.row}>
                {sizes.map((s) => {
                  const on = size === s;
                  return (
                    <Press key={s} onPress={() => setSize(s)} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{s}</Text>
                    </Press>
                  );
                })}
              </View>
            </View>
          ) : null}
          <Press
            disabled={!canConfirm}
            onPress={() =>
              onConfirm({
                color: color ?? (colors.length === 1 ? colors[0] : undefined),
                size: size ?? (sizes.length === 1 ? sizes[0] : undefined),
              })
            }
            style={[styles.cta, !canConfirm && { opacity: 0.4 }]}
          >
            <Text style={styles.ctaTxt}>{t("productOptions.confirmVariant", "Continuer")}</Text>
          </Press>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: { fontSize: 20, fontWeight: "800", color: NAVY },
  sub: { marginTop: 4, color: "#6B7289", fontSize: 13 },
  label: { fontWeight: "700", fontSize: 13, color: NAVY, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  chipOn: { backgroundColor: NAVY, borderColor: NAVY },
  chipTxt: { fontWeight: "700", fontSize: 13, color: NAVY },
  chipTxtOn: { color: "#fff" },
  cta: {
    marginTop: 20,
    height: 52,
    borderRadius: 16,
    backgroundColor: GOLD,
  },
  ctaTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 15 },
});
