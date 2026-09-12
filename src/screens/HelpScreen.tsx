import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronDown, Mail, MessageCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { GoldButton } from "../components/Buttons";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";
import { GOLD } from "../theme";
import { HELP_FAQS } from "../mock/account";

export function HelpScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { openOverlay } = useNav();
  const [open, setOpen] = useState<string | null>(HELP_FAQS[0]?.q ?? null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("profile.menu.help")} />
      <ScrollView contentContainerStyle={styles.body}>
        <Press onPress={() => openOverlay({ kind: "legal", page: "community" })} style={{ minHeight: 0 }}>
          <SurfaceCard>
            <Text style={{ fontWeight: "800", color: colors.foreground }}>{t("legal.community")}</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: colors.mutedForeground }}>
              {t("help.communityHint", "Interdits, bonnes pratiques, signalements.")}
            </Text>
          </SurfaceCard>
        </Press>
        {HELP_FAQS.map((f) => {
          const isOpen = open === f.q;
          return (
            <Press key={f.q} onPress={() => setOpen(isOpen ? null : f.q)} style={{ alignItems: "stretch" }}>
              <SurfaceCard padded={false}>
                <View style={styles.q}>
                  <Text style={{ flex: 1, fontWeight: "800", color: colors.foreground }}>{f.q}</Text>
                  <ChevronDown size={18} color={GOLD} style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }} />
                </View>
                {isOpen ? (
                  <Text style={[styles.a, { color: colors.mutedForeground }]}>{f.a}</Text>
                ) : null}
              </SurfaceCard>
            </Press>
          );
        })}
        <GoldButton
          label="Écrire au support"
          icon={<Mail size={16} color="#151022" />}
          onPress={() => {
            void Linking.openURL("mailto:hello@kidiplus.com").catch(() => {
              setToast("hello@kidiplus.com");
              setTimeout(() => setToast(null), 2000);
            });
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
          <MessageCircle size={14} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>hello@kidiplus.com</Text>
        </View>
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  q: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 14 },
  a: { paddingHorizontal: 14, paddingBottom: 14, fontSize: 13, lineHeight: 19 },
});
