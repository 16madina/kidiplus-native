import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { Logo } from "../Logo";
import { useAuth } from "../../context/auth";
import { formatMoney, normalizeCurrency } from "../../lib/money";
import { supabase } from "../../lib/supabase";
import { GOLD } from "../../theme";

type FirstSaleReward = {
  id: string;
  amount: number;
  currency: string;
  created_at: string;
  reward_key?: string;
  seen_at?: string | null;
};

const PLAYBACK_MS = 6_000;
const FIRST_SALE_ART = "https://kidiplus.com/gifts/kidiplus-first-sale.png";

/**
 * Same as kidiplus.com FirstSaleRewardOverlay:
 * DB creates one `first_sale_fee_waiver` row per seller at checkout.
 * Query unseen + realtime INSERT, then mark seen_at on close.
 */
export function FirstSaleRewardOverlay() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [reward, setReward] = useState<FirstSaleReward | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const closingRef = useRef(false);
  const pop = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user?.id) {
      setReward(null);
      return;
    }

    let cancelled = false;
    void supabase
      .from("seller_milestone_rewards")
      .select("id, amount, currency, created_at")
      .eq("seller_id", user.id)
      .eq("reward_key", "first_sale_fee_waiver")
      .is("seen_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setReward(data as FirstSaleReward);
      });

    const channel = supabase
      .channel(`first-sale-reward:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "seller_milestone_rewards",
          filter: `seller_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as FirstSaleReward;
          if (next.reward_key === "first_sale_fee_waiver" && !next.seen_at) {
            setReward(next);
            setImageFailed(false);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const close = useCallback(async () => {
    if (!reward || closingRef.current) return;
    closingRef.current = true;
    const current = reward;
    setReward(null);
    try {
      await supabase
        .from("seller_milestone_rewards")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", current.id);
    } finally {
      closingRef.current = false;
    }
  }, [reward]);

  useEffect(() => {
    if (!reward) return;
    pop.setValue(0);
    card.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
    const cardTimer = setTimeout(() => {
      Animated.timing(card, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }, 2700);
    const hide = setTimeout(() => void close(), PLAYBACK_MS);
    return () => {
      clearTimeout(cardTimer);
      clearTimeout(hide);
    };
  }, [reward, close, pop, card]);

  if (!reward) return null;

  const amount = formatMoney(Number(reward.amount), normalizeCurrency(reward.currency), i18n.language);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void close()}>
      <View style={styles.root} pointerEvents="box-none">
        <Press
          onPress={() => void close()}
          style={[styles.close, { top: insets.top + 12 }]}
          accessibilityLabel={t("common.close", "Fermer")}
        >
          <X size={18} color="#fff" />
        </Press>
        <View style={styles.center} pointerEvents="none">
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            {imageFailed ? (
              <Logo size={96} onDark />
            ) : (
              <Image
                source={{ uri: `${FIRST_SALE_ART}#reward=${encodeURIComponent(reward.id)}` }}
                style={styles.art}
                contentFit="contain"
                onError={() => setImageFailed(true)}
              />
            )}
          </Animated.View>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.card,
            { bottom: insets.bottom + 48, opacity: card, transform: [{ translateY: card.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
          ]}
        >
          <Text style={styles.title}>{t("gifts.firstSale.title")}</Text>
          <Text style={styles.sub}>{t("gifts.firstSale.subtitle")}</Text>
          <Text style={styles.amount}>{t("gifts.firstSale.amount", { amount })}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(8,12,26,0.55)" },
  close: {
    position: "absolute",
    right: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  art: { width: 210, height: 210 },
  card: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(244,181,45,0.35)",
    backgroundColor: "rgba(8,35,104,0.94)",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" },
  sub: { marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600", textAlign: "center" },
  amount: { marginTop: 8, color: GOLD, fontSize: 15, fontWeight: "900", textAlign: "center" },
});
