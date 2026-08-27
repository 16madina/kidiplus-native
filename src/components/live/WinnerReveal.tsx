import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Frown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Logo } from "../Logo";
import { supabase } from "../../lib/supabase";
import { resolveAvatarUrl } from "../../lib/storage";
import { GOLD, NAVY } from "../../theme";
import type { AuctionEndReveal } from "../../lib/live-host";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function displayName(full: string | null | undefined): string {
  if (!full) return "—";
  return full.trim().toUpperCase();
}

function firstName(full: string | null | undefined): string {
  if (!full) return "—";
  const trimmed = full.trim();
  const space = trimmed.indexOf(" ");
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

/** Logo KiDi+ ~1s, puis carte gagnant / invendu ~2s — comme kidiplus.com. */
export function WinnerReveal({
  reveal,
  onDone,
}: {
  reveal: AuctionEndReveal | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"logo" | "card">("logo");
  const [avatar, setAvatar] = useState<string | null>(null);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!reveal) {
      setPhase("logo");
      setAvatar(null);
      return;
    }
    setPhase("logo");
    setAvatar(null);
    const unsold = !reveal.winnerName || !reveal.winnerId;
    void Haptics.notificationAsync(
      unsold ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    ).catch(() => undefined);
    const t1 = setTimeout(() => setPhase("card"), 1000);
    const t2 = setTimeout(() => onDoneRef.current(), 3400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reveal?.endId]);

  useEffect(() => {
    if (!reveal?.winnerId || !UUID_RE.test(reveal.winnerId)) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", reveal.winnerId!)
        .maybeSingle();
      if (cancelled || !data?.avatar_url) return;
      const url = await resolveAvatarUrl(data.avatar_url);
      if (url && !cancelled) setAvatar(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [reveal?.endId, reveal?.winnerId]);

  if (!reveal) return null;

  const unsold = !reveal.winnerName || !reveal.winnerId;
  const shown = displayName(reveal.winnerName);
  const said = t("auction.winner.said", { name: firstName(reveal.winnerName) });
  const productLabel = reveal.productName?.trim().toUpperCase() || null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {phase === "logo" ? (
        <View style={styles.logoWrap}>
          <Logo size={96} onDark />
        </View>
      ) : unsold ? (
        <View style={styles.card}>
          <LinearGradient colors={["#E24B4B", "#9B1C1C"]} style={styles.frownRing}>
            <View style={styles.frownInner}>
              <Frown size={36} color="#fff" />
            </View>
          </LinearGradient>
          <Text style={styles.unsoldTitle}>{t("auction.unsold.title")}</Text>
          {productLabel ? <Text style={styles.productUnsold}>{productLabel}</Text> : null}
        </View>
      ) : (
        <View style={styles.card}>
          <LinearGradient colors={["#F7CE5A", "#D9A73A"]} style={styles.avRing}>
            <View style={styles.avInner}>
              <Text style={styles.avLetter}>{(shown[0] ?? "?").toUpperCase()}</Text>
              {avatar ? <Image source={{ uri: avatar }} style={styles.avImg} contentFit="cover" /> : null}
            </View>
          </LinearGradient>
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{t("auction.winner.badge", "Gagnant")}</Text>
          </View>
          <Text numberOfLines={1} style={styles.winnerName}>
            {shown}
          </Text>
          {productLabel ? (
            <Text numberOfLines={1} style={styles.productWin}>
              {productLabel}
            </Text>
          ) : null}
          <Text style={styles.said}>{said}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...FILL,
    zIndex: 58,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  logoWrap: {
    shadowColor: GOLD,
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
  },
  card: { width: "100%", maxWidth: 420, alignItems: "center", gap: 10 },
  frownRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  frownInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#3a1010",
    alignItems: "center",
    justifyContent: "center",
  },
  unsoldTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  productUnsold: {
    color: "#F0A8A8",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  avRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  avInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#10162B",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avLetter: { color: GOLD, fontSize: 34, fontWeight: "900" },
  avImg: { ...FILL, borderRadius: 999 },
  badge: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  badgeTxt: { color: NAVY, fontSize: 13, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  winnerName: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
    maxWidth: "94%",
  },
  productWin: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  said: { color: GOLD, fontSize: 18, fontWeight: "800", fontStyle: "italic" },
});
