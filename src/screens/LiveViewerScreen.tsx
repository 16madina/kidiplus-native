import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gavel, Gift, Heart, MoreVertical, Send, ShoppingBag, UserPlus, Wallet, X } from "lucide-react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Press } from "../components/Press";
import { Glass, GlassIcon, GlassIconButton } from "../components/Glass";
import { AuctionFinalCountdown } from "../components/live/AuctionFinalCountdown";
import { BidPulseFlash } from "../components/live/BidPulseFlash";
import { WinnerReveal } from "../components/live/WinnerReveal";
import { GiftAnimationOverlay } from "../components/live/GiftAnimationOverlay";
import { FloatingHearts } from "../components/live/FloatingHearts";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { ReferredBadge } from "../components/ReferredBadge";
import { ReportSheet } from "../components/moderation/ReportSheet";
import { PaymentSheet } from "../components/payments/PaymentSheet";
import { TopUpSheet } from "../components/wallet/TopUpSheet";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useFollow } from "../lib/follows";
import { fetchDefaultAddress } from "../lib/addresses";
import { canDeliver, fetchDeliverySettings } from "../lib/delivery";
import { GIFT_CATALOG, giftPrice, type GiftKey } from "../lib/gifts";
import { isBattleLiveActive, useBattleForLive } from "../lib/battles";
import { guestLiveKitIdentity } from "../lib/livekit";
import { useViewerLiveRoom } from "../lib/live-viewer";
import { useDemoViewerSim } from "../lib/use-demo-viewer-sim";
import { blockUserAndNotify, useBlockedIds } from "../lib/moderation";
import { convertMoney, formatMoney, nextBidAmount, normalizeCurrency } from "../lib/money";
import { fetchOrderById, type OrderView } from "../lib/orders";
import { isExpoGo } from "../lib/expo-go";
import { useViewerSystemPip } from "../lib/live-pip";
import { useLayout } from "../lib/layout";
import { supabase } from "../lib/supabase";
import { GOLD, LIVE_RED, NAVY, formatViewers } from "../theme";
import type { LiveStream } from "../mock/lives";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const LiveKitRemoteVideo = lazy(async () => {
  try {
    const mod = await import("../components/live/LiveKitRemoteVideo");
    return { default: mod.LiveKitRemoteVideo };
  } catch {
    return {
      default: function LiveKitUnavailable() {
        return <View style={FILL} />;
      },
    };
  }
});

export function LiveViewerScreen({ stream, active = true }: { stream: LiveStream; active?: boolean }) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { t, i18n } = useTranslation();
  const { closeOverlay, openOverlay } = useNav();
  const { user, openAuth, refreshUser } = useAuth();
  const s = stream;
  const liveId = s.liveId && !s.fictitious ? s.liveId : undefined;
  const liveVideo = Boolean(s.roomName && !s.fictitious) && !isExpoGo();
  const pip = useViewerSystemPip(!!liveVideo && active, closeOverlay);
  const identity = useMemo(
    () => user?.id ?? guestLiveKitIdentity(),
    [user?.id],
  );
  const displayName = user?.displayName?.trim() || "Invité";

  const room = s.fictitious
    ? useDemoViewerSim(normalizeCurrency(s.currency))
    : useViewerLiveRoom(liveId, {
        displayName,
        userId: user?.id ?? null,
        identity,
      });
  const battle = useBattleForLive(liveId ?? null);
  const battleActive = isBattleLiveActive(battle);
  const hostBattleLive =
    battle?.lives.find((l) => l.live_id === liveId) ??
    battle?.lives.find((l) => l.seller_id === s.sellerId) ??
    null;
  const guestBattleLive =
    battle?.lives.find((l) => l.live_id !== liveId && l.seller_id !== s.sellerId) ??
    battle?.lives.find((l) => l.live_id !== hostBattleLive?.live_id) ??
    null;

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [payOrder, setPayOrder] = useState<OrderView | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ id: string; text: string } | null>(null);
  const blockedIds = useBlockedIds();
  const follow = useFollow(s.sellerId && !s.fictitious ? s.sellerId : null);

  const requireAccount = () => {
    if (user) return true;
    setToast(t("auth.guest.participate", { defaultValue: "Crée un compte pour participer 🎉" }));
    openAuth("signup");
    return false;
  };
  const [buyerCountry, setBuyerCountry] = useState<string | null>(null);
  const [sellerCountry, setSellerCountry] = useState<string | null>(null);
  const [sellerSettings, setSellerSettings] = useState<Awaited<
    ReturnType<typeof fetchDeliverySettings>
  >>(null);

  const currency = normalizeCurrency(s.currency ?? room.currency);
  const walletCurrency = normalizeCurrency(user?.walletCurrency);
  const fmt = useCallback(
    (n: number) => formatMoney(n, currency, i18n.language),
    [currency, i18n.language],
  );

  const featured = room.featured;
  const auctionLive = !!room.auction && featured && room.auction.productId === featured.id;
  const nextBid = featured
    ? nextBidAmount(Number(featured.price ?? featured.start_price ?? 0), currency)
    : 0;
  const isHighest =
    !!user &&
    !!room.lastBid &&
    !!featured &&
    room.lastBid.productId === featured.id &&
    room.lastBid.bidderId === user.id &&
    room.lastBid.auctionRound === (featured.auction_round ?? room.auction?.auctionRound ?? 1);

  const eligibility = useMemo(
    () => canDeliver({ settings: sellerSettings, sellerCountry, buyerCountry }),
    [sellerSettings, sellerCountry, buyerCountry],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // Auto-leave if the host is already blocked (Apple 1.2 / web parity).
  useEffect(() => {
    if (!s.sellerId || s.fictitious) return;
    if (!blockedIds.has(s.sellerId)) return;
    setToast(t("block.autoClosedLive"));
    const id = setTimeout(() => closeOverlay(), 900);
    return () => clearTimeout(id);
  }, [blockedIds, s.sellerId, s.fictitious, closeOverlay, t]);

  const openMore = () => {
    if (!requireAccount()) return;
    Alert.alert(s.seller, undefined, [
      {
        text: t("report.action"),
        onPress: () => setReportOpen(true),
      },
      {
        text: t("block.action"),
        style: "destructive",
        onPress: () => {
          Alert.alert(t("block.action"), t("block.confirm"), [
            { text: t("block.cancel"), style: "cancel" },
            {
              text: t("block.action"),
              style: "destructive",
              onPress: () => {
                if (!s.sellerId) return;
                void blockUserAndNotify(s.sellerId, {
                  handle: s.handle,
                  displayName: s.seller,
                  avatarUrl: s.avatar,
                  liveId: liveId,
                }).then((r) => {
                  if (r.ok) {
                    setToast(t("block.blocked"));
                    setTimeout(() => closeOverlay(), 700);
                  } else {
                    setToast(r.error ?? t("block.failed"));
                  }
                });
              },
            },
          ]);
        },
      },
      { text: t("common.share", { defaultValue: "Partager" }), onPress: shareLive },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const shareLive = () => {
    const id = liveId || s.liveId || s.id;
    void Share.share({
      message: `https://kidiplus.com/live/${id}`,
      title: s.title || "KiDi+",
    });
  };

  useEffect(() => {
    if (!user?.id) {
      setBuyerCountry(null);
      return;
    }
    let cancelled = false;
    void fetchDefaultAddress(user.id).then((addr) => {
      if (!cancelled) setBuyerCountry(addr?.country ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!s.sellerId || s.fictitious) return;
    let cancelled = false;
    void (async () => {
      const [settings, profile] = await Promise.all([
        fetchDeliverySettings(s.sellerId!),
        supabase.from("profiles").select("country").eq("id", s.sellerId!).maybeSingle(),
      ]);
      if (cancelled) return;
      setSellerSettings(settings);
      setSellerCountry((profile.data as { country?: string | null } | null)?.country ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [s.sellerId, s.fictitious]);

  // Winner of auction → open payment if current user won (create order then pay).
  useEffect(() => {
    const reveal = room.lastReveal;
    if (!reveal || !user?.id || !reveal.winnerId) return;
    if (reveal.winnerId !== user.id) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("create_live_order", {
        _product_id: reveal.productId,
        _kind: "auction",
      } as never);
      if (cancelled) return;
      if (error) {
        setToast(error.message);
        return;
      }
      const payload = data as { ok?: boolean; order_id?: string; order?: { id?: string }; error?: string } | null;
      const orderId = payload?.order_id ?? payload?.order?.id;
      if (!payload?.ok || !orderId) {
        setToast(String(payload?.error ?? t("live.bidFailed")));
        return;
      }
      const order = await fetchOrderById(String(orderId));
      if (order && !cancelled) setPayOrder(order);
    })();
    return () => {
      cancelled = true;
    };
  }, [room.lastReveal?.endId, user?.id, t]);

  const gateDelivery = (): boolean => {
    if (eligibility.eligible) return true;
    if (eligibility.reason === "no_address") {
      Alert.alert(
        t("address.title", "Adresses"),
        t("delivery.noAddressBlock", "Ajoute une adresse de livraison pour continuer"),
      );
      return false;
    }
    setToast(t("delivery.notInYourCountry", "Livraison indisponible dans ton pays"));
    return false;
  };

  const onBid = async () => {
    // Demo lives: bid without account/wallet gates so the full auction
    // flow (bid -> sudden death -> winner) is reviewable by Apple.
    if (s.fictitious) {
      setBusy(true);
      try {
        const res = await room.placeBid();
        if (res.ok) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        } else {
          setToast(t("live.waitingForSeller"));
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!liveId) return;
    if (!user) {
      requireAccount();
      return;
    }
    if (!auctionLive || !featured) {
      setToast(t("live.waitingForSeller"));
      return;
    }
    if (isHighest) {
      setToast(t("live.highestBidder"));
      return;
    }
    if (!gateDelivery()) return;

    const need = convertMoney(nextBid, currency, walletCurrency);
    if ((user.walletBalance ?? 0) < need) {
      setToast(t("live.bidInsufficientFunds"));
      setTopUpOpen(true);
      return;
    }

    setBusy(true);
    try {
      const res = await room.placeBid();
      if (!res.ok) {
        if (res.error === "already_highest") setToast(t("live.highestBidder"));
        else if (res.error === "no_address") {
          Alert.alert(
            t("address.title", "Adresses"),
            t("delivery.noAddressBlock", "Ajoute une adresse de livraison"),
          );
        } else if (
          res.error === "no_country_coverage" ||
          res.error === "courier_country_mismatch" ||
          res.error === "delivery_blocked"
        ) {
          setToast(t("delivery.notInYourCountry", "Livraison indisponible dans ton pays"));
        } else {
          setToast(res.error === "auction_ended" ? t("live.auctionEndedBid", "L'enchère est terminée.") : t("live.bidFailed"));
        }
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const onBuy = async () => {
    if (s.fictitious) {
      const res = await room.buyNow({ productId: featured?.id });
      if (res.ok) setToast(t("live.demoPurchase", "Achat démo confirmé 🎉"));
      return;
    }
    if (!liveId || !featured) return;
    if (!user) {
      requireAccount();
      return;
    }
    if (featured.mode !== "fixed" || featured.status !== "active") {
      setToast(t("live.waitingForSeller"));
      return;
    }
    if (!gateDelivery()) return;
    setBusy(true);
    try {
      const res = await room.buyNow({ productId: featured.id });
      if (!res.ok) {
        if (res.error === "no_address") {
          Alert.alert(
            t("address.title", "Adresses"),
            t("delivery.noAddressBlock", "Ajoute une adresse de livraison"),
          );
        } else {
          setToast(res.error || t("live.buy_sheet.fail"));
        }
        return;
      }
      const order = await fetchOrderById(res.orderId);
      if (order) setPayOrder(order);
      else setToast(t("live.buy_sheet.fail"));
    } finally {
      setBusy(false);
    }
  };

  const onSendChat = async () => {
    const text = draft.trim();
    if (!text) return;
    if (!user) {
      requireAccount();
      return;
    }
    setDraft("");
    Keyboard.dismiss();
    await room.sendChat(text);
  };

  const onGift = async (key: GiftKey) => {
    if (s.fictitious) {
      const res = await room.sendGift(key);
      if (res.ok) {
        setGiftsOpen(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
      return;
    }
    if (!liveId) return;
    if (!user) {
      requireAccount();
      return;
    }
    const price = giftPrice(key, walletCurrency);
    if ((user.walletBalance ?? 0) < price) {
      setToast(t("gifts.err.insufficient"));
      setGiftsOpen(false);
      setTopUpOpen(true);
      return;
    }
    setBusy(true);
    try {
      const res = await room.sendGift(key);
      if (!res.ok) {
        setToast(res.error || t("gifts.err.unknown"));
        return;
      }
      await refreshUser();
      setGiftsOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const viewersShown = liveId ? Math.max(room.viewers, s.viewers) : s.viewers;
  const ended = room.liveStatus === "ended";

  return (
    <View style={styles.root}>
      {liveVideo && s.roomName ? (
        <Suspense
          fallback={
            <View style={[FILL, styles.videoWait]}>
              <ActivityIndicator color="#fff" />
            </View>
          }
        >
          <LiveKitRemoteVideo
            roomName={s.roomName}
            identity={identity}
            displayName={displayName}
            battleActive={battleActive}
            hostFighter={
              hostBattleLive
                ? {
                    displayName: hostBattleLive.display_name || s.seller,
                    avatarUrl: hostBattleLive.avatar_url,
                  }
                : { displayName: s.seller, avatarUrl: s.avatar }
            }
            guestFighter={
              guestBattleLive
                ? {
                    displayName: guestBattleLive.display_name,
                    avatarUrl: guestBattleLive.avatar_url,
                  }
                : null
            }
          />
        </Suspense>
      ) : (
        <Image source={{ uri: s.thumbnail }} style={FILL} contentFit="cover" />
      )}
      {pip.active ? null : (
      <>
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.75)"]}
        style={FILL}
        pointerEvents="none"
      />

      <View
        pointerEvents="none"
        style={[styles.auctionStack, { top: insets.top + layout.vs(96) }]}
      >
        <AuctionFinalCountdown
          secondsLeft={room.timeLeft}
          active={!!auctionLive && !ended}
          embedded
          compact={layout.compact}
          suddenDeath={(room.suddenDeathTick ?? 0) > 0}
        />
        <BidPulseFlash
          text={
            room.lastBid && featured && room.lastBid.productId === featured.id
              ? `${room.lastBid.bidderName} · ${fmt(room.lastBid.amount)}`
              : null
          }
          pulseKey={room.lastBid?.ts ?? 0}
          embedded
          lower={!(auctionLive && room.timeLeft > 0 && room.timeLeft <= 3)}
        />
      </View>
      <WinnerReveal reveal={room.lastReveal} onDone={room.clearReveal} />
      <GiftAnimationOverlay trigger={room.lastGift} />
      <FloatingHearts pulse={room.heartPulse ?? 0} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Glass tone="dark" intensity={42} radius={999}>
          <View style={styles.seller}>
            <Image
              source={{ uri: s.avatar }}
              style={[styles.av, layout.narrow && { width: 32, height: 32, borderRadius: 16 }]}
            />
            <View style={{ maxWidth: layout.narrow ? 140 : 180 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={[styles.name, { fontSize: layout.s(14) }]} numberOfLines={1}>
                  {s.seller}
                </Text>
                {s.isVerified ? <VerifiedBadge size={13} /> : null}
                <ReferredBadge referred={s.isReferred} size={12} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.live, ended && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                  {!ended ? <View style={styles.dot} /> : null}
                  <Text style={styles.liveText}>{ended ? t("live.ended") : "LIVE"}</Text>
                </View>
                <Text style={styles.viewers}>{formatViewers(viewersShown)}</Text>
              </View>
            </View>
          </View>
        </Glass>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {user ? (
            <Press
              onPress={() => openOverlay({ kind: "wallet" })}
              style={{ minHeight: 0, minWidth: 0 }}
            >
              <Glass tone="dark" intensity={42} radius={999}>
                <View style={styles.walletPill}>
                  <Wallet size={13} color={GOLD} />
                  <Text style={styles.walletTxt} numberOfLines={1}>
                    {formatMoney(user.walletBalance, walletCurrency, i18n.language)}
                  </Text>
                </View>
              </Glass>
            </Press>
          ) : null}
          {!follow.isSelf && s.sellerId && !s.fictitious ? (
            <Press
              onPress={() => {
                if (!requireAccount()) return;
                void follow.toggle();
              }}
              style={{ minHeight: 0, minWidth: 0 }}
            >
              <Glass tone={follow.following ? "dark" : "gold"} intensity={42} radius={999}>
                <View style={styles.followPill}>
                  <UserPlus size={13} color={follow.following ? "#fff" : NAVY} />
                  <Text style={[styles.followTxt, follow.following && { color: "#fff" }]}>
                    {follow.following ? t("follow.following") : t("follow.follow")}
                  </Text>
                </View>
              </Glass>
            </Press>
          ) : null}
          <GlassIconButton size={layout.icon} tone="dark" onPress={openMore}>
            <MoreVertical size={18} color="#fff" />
          </GlassIconButton>
          <GlassIconButton size={layout.icon} tone="dark" onPress={closeOverlay}>
            <X size={20} color="#fff" />
          </GlassIconButton>
        </View>
      </View>

      {ended ? (
        <View style={[styles.endedCard, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.endedTitle}>{t("live.endedTitle")}</Text>
          <Press style={styles.endedBtn} onPress={closeOverlay}>
            <Text style={styles.endedBtnTxt}>{t("live.backHome")}</Text>
          </Press>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.bottom, { paddingBottom: insets.bottom + 12, gap: layout.compact ? 6 : 10 }]}
          pointerEvents="box-none"
        >
          {room.chat.length > 0 ? (
            <View style={styles.chatList}>
              {room.chat.slice(layout.compact ? -3 : -6).map((m) => (
                <Press
                  key={m.id}
                  onLongPress={() => {
                    if (m.system) return;
                    if (!requireAccount()) return;
                    setReportMsg({ id: m.id, text: `${m.user}: ${m.text}` });
                  }}
                  style={{ minHeight: 0, alignItems: "flex-start" }}
                >
                  <View style={styles.chatBubble}>
                    {m.system ? (
                      <Text style={styles.chatSystem}>{m.text}</Text>
                    ) : (
                      <Text style={styles.chatLine}>
                        <Text style={styles.chatUser}>{m.user} </Text>
                        {m.text}
                      </Text>
                    )}
                  </View>
                </Press>
              ))}
            </View>
          ) : null}

          {auctionLive || (featured?.mode === "fixed" && featured.status === "active") ? (
            <Glass tone="gold" intensity={46} radius={20} padded>
              <Text style={styles.productEyebrow}>
                {auctionLive
                  ? t("live.currentBid")
                  : t("live.buyNow")}
              </Text>
              <Text style={styles.productTitle} numberOfLines={1}>
                {featured!.name}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{fmt(Number(featured!.price ?? featured!.start_price))}</Text>
                {auctionLive && room.timeLeft > 0 ? (
                  <Text style={styles.timer}>{room.timeLeft}s</Text>
                ) : null}
              </View>
              {room.lastBid && room.lastBid.productId === featured!.id ? (
                <Text style={styles.bidder}>{room.lastBid.bidderName}</Text>
              ) : null}
            </Glass>
          ) : featured || room.products.length > 0 ? (
            <Glass tone="dark" intensity={40} radius={16} padded>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {featured?.image_url ? (
                  <Image source={{ uri: featured.image_url }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.waitTxt}>
                    {t("live.nextItemSoon", { name: featured?.name ? `${featured.name} ⏳` : "⏳" })}
                  </Text>
                </View>
              </View>
            </Glass>
          ) : null}

          <View style={[styles.chatRow, layout.narrow && { gap: 6 }]}>
            <Glass tone="dark" intensity={40} radius={999} style={{ flex: 1 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t("live.chatPlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={[styles.input, { height: layout.icon, fontSize: layout.s(14) }]}
                onSubmitEditing={() => void onSendChat()}
                returnKeyType="send"
              />
            </Glass>
            <GlassIconButton
              size={layout.icon}
              tone="dark"
              onPress={() => {
                if (!requireAccount()) return;
                room.sendHeart();
              }}
            >
              <Heart size={18} color="#fff" />
            </GlassIconButton>
            {liveId || s.fictitious ? (
              <GlassIconButton
                size={layout.icon}
                tone="dark"
                onPress={() => {
                  if (!requireAccount()) return;
                  setGiftsOpen(true);
                }}
              >
                <Gift size={18} color={GOLD} />
              </GlassIconButton>
            ) : null}
            <GlassIconButton size={layout.icon} tone="gold" onPress={() => void onSendChat()}>
              <Send size={18} color="#fff" />
            </GlassIconButton>
          </View>

          {featured && auctionLive ? (
            <Press
              style={[styles.bid, { height: layout.vs(48) }]}
              onPress={() => void onBid()}
              disabled={busy || isHighest}
            >
              <LinearGradient colors={["#F7CE5A", "#E8B93B", "#D9A73A"]} style={styles.bidGrad}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.5)", "rgba(255,255,255,0)"]}
                  style={styles.bidShine}
                  pointerEvents="none"
                />
                <Gavel size={18} color={NAVY} />
                <Text style={[styles.bidText, { fontSize: layout.s(15) }]} numberOfLines={1}>
                  {isHighest
                    ? t("live.youLead")
                    : t("live.bidAt", { amount: fmt(nextBid) })}
                </Text>
              </LinearGradient>
            </Press>
          ) : featured && featured.mode === "fixed" && featured.status === "active" ? (
            <Press
              style={[styles.bid, { height: layout.vs(48) }]}
              onPress={() => void onBuy()}
              disabled={busy}
            >
              <LinearGradient colors={["#F7CE5A", "#E8B93B", "#D9A73A"]} style={styles.bidGrad}>
                <ShoppingBag size={18} color={NAVY} />
                <Text style={[styles.bidText, { fontSize: layout.s(15) }]} numberOfLines={1}>
                  {t("live.buyNowPrice", { amount: fmt(Number(featured.price)) })}
                </Text>
              </LinearGradient>
            </Press>
          ) : null}

          {toast ? (
            <View style={styles.toast}>
              <Text style={styles.toastTxt}>{toast}</Text>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}
      </>
      )}

      <Modal visible={giftsOpen} animationType="slide" transparent onRequestClose={() => setGiftsOpen(false)}>
        <Press style={styles.sheetBackdrop} onPress={() => setGiftsOpen(false)}>
          <View />
        </Press>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{t("gifts.title")}</Text>
            <Press onPress={() => setGiftsOpen(false)} style={styles.sheetClose}>
              <X size={20} color="#fff" />
            </Press>
          </View>
          <Text style={styles.sheetSub}>{t("gifts.subtitle")}</Text>
          <ScrollView contentContainerStyle={styles.giftGrid}>
            {GIFT_CATALOG.map((g) => (
              <Press
                key={g.key}
                style={styles.giftCell}
                disabled={busy}
                onPress={() => void onGift(g.key)}
              >
                <Text style={styles.giftEmoji}>{g.emoji}</Text>
                <Text style={styles.giftName}>{t(g.nameKey)}</Text>
                <Text style={styles.giftPrice}>
                  {formatMoney(giftPrice(g.key, walletCurrency), walletCurrency, i18n.language)}
                </Text>
              </Press>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <PaymentSheet
        order={payOrder}
        onClose={() => setPayOrder(null)}
        onPaid={(msg) => {
          setPayOrder(null);
          setToast(msg);
          void refreshUser();
        }}
      />
      <TopUpSheet
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        onDone={(msg) => {
          setTopUpOpen(false);
          setToast(msg);
          void refreshUser();
        }}
      />
      <ReportSheet
        open={reportOpen || !!reportMsg}
        onClose={() => {
          setReportOpen(false);
          setReportMsg(null);
        }}
        targetType={reportMsg ? "message" : "live"}
        targetId={reportMsg?.id || liveId || s.id || s.sellerId || ""}
        defaultNote={reportMsg?.text || (s.seller ? `Live host: ${s.seller}` : undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  videoWait: { alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    zIndex: 50,
  },
  seller: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  av: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: GOLD },
  name: { color: "#fff", fontWeight: "800" },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: LIVE_RED,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  viewers: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700" },
  walletPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8 },
  walletTxt: { color: "#fff", fontSize: 11, fontWeight: "800", maxWidth: 88 },
  followPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8 },
  followTxt: { color: NAVY, fontSize: 11, fontWeight: "800" },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 0, gap: 10, zIndex: 40 },
  chatList: { gap: 4, marginBottom: 4 },
  chatBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "88%",
  },
  chatLine: { color: "#fff", fontSize: 13, fontWeight: "600" },
  chatUser: { color: GOLD, fontWeight: "800" },
  chatSystem: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700" },
  productEyebrow: { color: GOLD, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  productTitle: { color: "#fff", fontWeight: "700", marginTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 },
  price: { color: GOLD, fontSize: 20, fontWeight: "900" },
  timer: { color: "#fff", fontWeight: "800", fontVariant: ["tabular-nums"] },
  bidder: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", marginTop: 2 },
  waitTxt: { color: "rgba(255,255,255,0.85)", fontWeight: "700", textAlign: "center" },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { height: 44, color: "#fff", paddingHorizontal: 16 },
  bid: { height: 48, borderRadius: 999, minHeight: 48, width: "100%", overflow: "hidden" },
  bidGrad: {
    height: 48,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    width: "100%",
  },
  bidShine: { position: "absolute", left: 0, right: 0, top: 0, height: 20 },
  bidText: { color: NAVY, fontWeight: "900", fontSize: 16 },
  toast: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    marginBottom: 8,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastTxt: { color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 13 },
  auctionStack: {
    position: "absolute",
    left: 0,
    right: 72,
    zIndex: 55,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  giftFlash: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 56,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  giftFlashTxt: { color: "#fff", fontWeight: "800" },
  endedCard: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    zIndex: 60,
  },
  endedTitle: { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  endedBtn: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 48,
  },
  endedBtnTxt: { color: NAVY, fontWeight: "900", fontSize: 16 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#12141F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    maxHeight: "55%",
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  sheetClose: { minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" },
  sheetSub: { color: "rgba(255,255,255,0.65)", marginTop: 4, marginBottom: 12 },
  giftGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 12 },
  giftCell: {
    width: "30%",
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
    minHeight: 88,
  },
  giftEmoji: { fontSize: 28 },
  giftName: { color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  giftPrice: { color: GOLD, fontSize: 11, fontWeight: "800" },
});
