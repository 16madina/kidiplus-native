import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  Mic,
  MicOff,
  Package,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Video,
  VideoOff,
  X,
} from "lucide-react-native";
import { Press } from "../Press";
import { GOLD, NAVY } from "../../theme";

const ICON = 18;
const STROKE = 1.9;
const GLASS = "rgba(10,12,20,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.16)";
const OFF = "rgba(216,44,52,0.82)";

/**
 * During Défi Plus the right rail is replaced by this gold + FAB
 * (same as kidiplus.com BattleHostBar).
 */
export function BattleHostBar({
  micOn,
  camOn,
  filtersActive = false,
  onToggleMic,
  onToggleCam,
  onFlip,
  onLeave,
  onOpenModerators,
  onOpenProducts,
  onOpenFilters,
}: {
  micOn: boolean;
  camOn: boolean;
  filtersActive?: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onFlip: () => void;
  onLeave: () => void;
  onOpenModerators: () => void;
  onOpenProducts: () => void;
  onOpenFilters: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const tools: Array<{ key: string; label: string; onPress: () => void; node: ReactNode; off?: boolean; accent?: boolean }> = [
    {
      key: "mic",
      label: micOn
        ? t("battle.tools.muteMic", "Couper le micro")
        : t("battle.tools.unmuteMic", "Réactiver le micro"),
      onPress: onToggleMic,
      node: micOn ? <Mic size={ICON} color="#fff" strokeWidth={STROKE} /> : <MicOff size={ICON} color="#fff" strokeWidth={STROKE} />,
      off: !micOn,
    },
    {
      key: "cam",
      label: camOn
        ? t("battle.tools.muteCam", "Couper la caméra")
        : t("battle.tools.unmuteCam", "Activer la caméra"),
      onPress: onToggleCam,
      node: camOn ? <Video size={ICON} color="#fff" strokeWidth={STROKE} /> : <VideoOff size={ICON} color="#fff" strokeWidth={STROKE} />,
      off: !camOn,
    },
    {
      key: "flip",
      label: t("battle.tools.flip", "Retourner la caméra"),
      onPress: onFlip,
      node: <RefreshCw size={ICON} color="#fff" strokeWidth={STROKE} />,
    },
    {
      key: "filters",
      label: t("battle.more.settings", "Filtres"),
      onPress: () => {
        close();
        onOpenFilters();
      },
      node: <Sparkles size={ICON} color={filtersActive ? NAVY : "#fff"} strokeWidth={STROKE} />,
      accent: filtersActive,
    },
    {
      key: "products",
      label: t("battle.more.products", "Articles"),
      onPress: () => {
        close();
        onOpenProducts();
      },
      node: <Package size={ICON} color="#fff" strokeWidth={STROKE} />,
    },
    {
      key: "mods",
      label: t("battle.more.moderators", "Modérateurs"),
      onPress: () => {
        close();
        onOpenModerators();
      },
      node: <Shield size={ICON} color="#fff" strokeWidth={STROKE} />,
    },
    {
      key: "leave",
      label: t("battle.hud.leave", "Quitter le défi"),
      onPress: () => {
        close();
        onLeave();
      },
      node: <LogOut size={ICON} color="#fff" strokeWidth={STROKE} />,
      off: true,
    },
  ];

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open ? (
        <Press haptic="none" onPress={close} style={styles.dismiss} accessibilityLabel={t("battle.more.close", "Fermer")} />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[styles.stack, { bottom: insets.bottom + 72, right: Math.max(10, insets.right) }]}
      >
        {open
          ? [...tools].reverse().map((item) => (
              <Press
                key={item.key}
                onPress={item.onPress}
                accessibilityLabel={item.label}
                style={[styles.tool, item.off && styles.toolOff, item.accent && styles.toolAccent]}
              >
                {item.node}
              </Press>
            ))
          : null}
        <Press
          onPress={() => setOpen((v) => !v)}
          accessibilityLabel={open ? t("battle.more.close", "Fermer") : t("battle.more.title")}
          style={[styles.fab, open && styles.fabOpen]}
        >
          {open ? <X size={22} color="#fff" strokeWidth={2.4} /> : <Plus size={24} color={NAVY} strokeWidth={2.6} />}
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dismiss: {
    ...StyleSheet.absoluteFill,
    minHeight: 0,
    minWidth: 0,
    zIndex: 33,
  },
  stack: {
    position: "absolute",
    zIndex: 34,
    alignItems: "center",
    gap: 10,
  },
  fab: {
    width: 48,
    height: 48,
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabOpen: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    shadowOpacity: 0,
  },
  tool: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  toolOff: { backgroundColor: OFF, borderColor: "rgba(255,255,255,0.28)" },
  toolAccent: { backgroundColor: GOLD, borderColor: "rgba(255,255,255,0.45)" },
});
