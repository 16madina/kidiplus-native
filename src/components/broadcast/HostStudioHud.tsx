import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import {
  Eye,
  Mic,
  MicOff,
  Minimize2,
  Package,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Swords,
  Video,
  VideoOff,
  X,
} from "lucide-react-native";
import { Press } from "../Press";
import { AddProductSheet } from "./AddProductSheet";
import { ShopPickerSheet } from "./ShopPickerSheet";
import { ModeratorsSheet } from "./ModeratorsSheet";
import { BattleInviteSheet } from "./BattleInviteSheet";
import { BattleScoreHud } from "../battle/BattleScoreHud";
import { BattleFeaturedRow, BattlePeerProductSheet } from "../battle/BattleFeaturedRow";
import { BattleHostBar } from "../battle/BattleHostBar";
import { DefiPlusIntroOverlay } from "../battle/DefiPlusIntroOverlay";
import { BattleResultOverlay } from "../battle/BattleResultOverlay";
import { BattleSuddenDeathOverlay } from "../battle/BattleSuddenDeathOverlay";
import { FiltersCarousel } from "./FiltersCarousel";
import { PosterGestureLayer } from "./PosterGestureLayer";
import { LiveEffectsOverlay } from "./LiveEffectsOverlay";
import { LiveFxOverlay } from "../live/LiveFxOverlay";
import { AuctionFinalCountdown } from "../live/AuctionFinalCountdown";
import { HostFeaturedCard, useHostFeaturedLayout } from "./HostFeaturedCard";
import { BidPulseFlash } from "../live/BidPulseFlash";
import { WinnerReveal } from "../live/WinnerReveal";
import { GiftAnimationOverlay } from "../live/GiftAnimationOverlay";
import { useAuth } from "../../context/auth";
import { useFilter } from "../../lib/filters/filter-context";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
import { EMPTY_LIVE_FX, liveTintForLens } from "../../lib/live-fx";
import {
  fmtDuration,
  useHostLiveSession,
  type AuctionEndReveal,
  type LiveProductRow,
} from "../../lib/live-host";
import {
  battleAccept,
  battleDecline,
  battleEnd,
  battleInvite,
  isBattleFinished,
  isBattleLiveActive,
  usePendingBattleInvite,
  type HydratedBattle,
} from "../../lib/battles";
import { battleDockMetrics, battleFighters, battleRemainingMs } from "../../lib/battle-timing";
import { pickBattleFeatured } from "../../lib/battle-featured";
import { useBattlePeerProducts } from "../../lib/use-battle-peer-products";
import { isDefiPlusIntroActive, resolveDefiPlusIntroStart } from "../../lib/defi-plus";
import { useHostPrelaunchSim } from "../../lib/use-prelaunch-live-sim";
import { formatMoney } from "../../lib/money";
import type { LiveDraftProduct } from "../../lib/broadcast-products";
import { useLayout } from "../../lib/layout";
import {
  HOST_PORTRAIT_CARD_WIDTH,
  hostAuctionGutter,
  hostAuctionTopExtra,
  hostFeaturedRight,
  hostRailBottom,
} from "../../lib/host-hud-layout";
import { GOLD, NAVY } from "../../theme";

const RAIL_BG = "rgba(10,12,20,0.55)";
const RAIL_BORDER = "rgba(255,255,255,0.16)";
const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function HostStudioHud({
  liveId,
  identity,
  displayName,
  viewerFallback,
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  onFlip,
  onEnd,
  onMinimize,
  onBattleAccepted,
  battle,
}: {
  liveId: string;
  identity: string;
  displayName: string;
  viewerFallback: number;
  micOn: boolean;
  camOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onFlip: () => void;
  onEnd: () => void;
  /** Leave the studio without ending the live (reconnect banner + 5 min expiry). */
  onMinimize?: () => void;
  onBattleAccepted?: () => void | Promise<void>;
  cameraFacing?: "front" | "back";
  battle?: HydratedBattle | null;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { user } = useAuth();
  const { activeLens } = useFilter();
  const { backgroundMode } = useLiveEffects();
  const hostFx = {
    ...EMPTY_LIVE_FX,
    backgroundMode,
    tint: liveTintForLens(activeLens),
  };
  const session = useHostLiveSession({ liveId, identity, displayName });
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [modsOpen, setModsOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [incomingBusy, setIncomingBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<AuctionEndReveal | null>(null);
  const [suddenDeathMode, setSuddenDeathMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [peerOpen, setPeerOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [dismissedResultId, setDismissedResultId] = useState<string | null>(null);
  const [introFallbackAt, setIntroFallbackAt] = useState<number | null>(null);
  const incoming = usePendingBattleInvite(user?.id ?? null);
  const battleActive = isBattleLiveActive(battle);
  const resultOpen = isBattleFinished(battle) && !!battle && battle.session.id !== dismissedResultId;
  const fighters = battle && battleActive ? battleFighters(battle, liveId) : null;
  const dock = battleDockMetrics(insets.top, Dimensions.get("window").height);
  const remainingMs = battle && battleActive ? battleRemainingMs(battle.session, nowMs) : 0;
  const introStartsAt = battleActive
    ? resolveDefiPlusIntroStart(battle?.session.started_at, introFallbackAt)
    : null;
  const introOn = battleActive && isDefiPlusIntroActive(introStartsAt, nowMs);
  const peerProducts = useBattlePeerProducts(battleActive ? fighters?.right.liveId ?? null : null);
  const peerFeatured = pickBattleFeatured(peerProducts);

  // Pre-launch crowd (admin → Simu) : fake viewers, comments and bids.
  useHostPrelaunchSim(session, session.currency || user?.walletCurrency || "EUR");

  const realViewers = Math.max(0, Math.max(session.presenceCount - 1, viewerFallback));
  const viewers = session.simViewers ?? realViewers;
  const featured = session.featured;
  const featuredLayout = useHostFeaturedLayout();
  const auctionOnFeatured = session.auction && featured && session.auction.productId === featured.id;
  const currency = session.currency || user?.walletCurrency || "EUR";
  const fmt = (n: number) => formatMoney(n, currency, i18n.language);
  const countdownOn =
    !!session.auction &&
    !reveal &&
    session.timeLeft > 0 &&
    session.timeLeft <= (suddenDeathMode ? 10 : 3);
  /** After mort subite leaves, a simultaneous bid sits a bit lower. */
  const bidLower = !flash && !countdownOn;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!battleActive) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [battleActive, battle?.session.id]);

  useEffect(() => {
    if (!battleActive) {
      setIntroFallbackAt(null);
      return;
    }
    setIntroFallbackAt((prev) => prev ?? Date.now());
  }, [battleActive, battle?.session.id]);

  const leaveBattle = () => {
    if (!battle?.session.id || !user?.id) return;
    Alert.alert(t("battle.hud.leave"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("battle.hud.leave"),
        style: "destructive",
        onPress: () => {
          void battleEnd(battle.session.id, "forfeit", user.id);
        },
      },
    ]);
  };

  useEffect(() => {
    const text = battle?.session.last_sale_text;
    const at = battle?.session.last_sale_at;
    if (!text || !at || !battleActive) return;
    if (Date.now() - Date.parse(at) > 8000) return;
    setToast(text);
  }, [battle?.session.last_sale_text, battle?.session.last_sale_at, battleActive]);

  const requestRematch = () => {
    if (!battle || !user?.id) return;
    const other = battle.lives.find((l) => l.seller_id !== user.id);
    if (!other) return;
    setDismissedResultId(battle.session.id);
    void battleInvite({
      fromLiveId: liveId,
      toSellerId: other.seller_id,
      durationSec: battle.session.duration_sec,
      rematchOf: battle.session.id,
    }).then((res) => {
      setToast(res.ok ? t("battle.invite.sent") : res.error ?? t("battle.invite.failed"));
    });
  };

  useEffect(() => {
    if (session.suddenDeathTick === 0) return;
    setFlash(true);
    setSuddenDeathMode(true);
    const id = setTimeout(() => setFlash(false), 2600);
    return () => clearTimeout(id);
  }, [session.suddenDeathTick]);

  // Mort subite ends with the auction (or when a new round starts).
  const auctionKey = session.auction
    ? `${session.auction.productId}:${session.auction.auctionRound ?? 1}`
    : "none";
  useEffect(() => {
    setSuddenDeathMode(false);
  }, [auctionKey]);

  useEffect(() => {
    if (!session.lastEnd) return;
    setReveal(session.lastEnd);
  }, [session.lastEnd?.endId]);

  const soon = (msg: string) => setToast(msg);

  const runFeaturedAction = async (p: LiveProductRow) => {
    if (busyId) return;
    setBusyId(p.id);
    try {
      const err =
        p.mode === "auction" ? await session.startAuction(p) : await session.toggleFixed(p);
      if (err === "auction_already_running") {
        setToast(t("live.auctionAlreadyRunning", "Une enchère est déjà en cours. Termine-la d'abord."));
      } else if (err) {
        setToast(
          p.mode === "auction"
            ? t("live.startAuctionFailed", "Impossible de démarrer l'enchère")
            : t("common.error", "Une erreur est survenue"),
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const addProducts = async (items: LiveDraftProduct[]) => {
    if (!user?.id) return;
    for (const item of items) {
      const res = await session.addDraft(item, user.id);
      if (!res.ok) {
        setToast(res.error ?? t("common.error", "Une erreur est survenue"));
        return;
      }
    }
    setToast(t("live.productAdded", "Produit ajouté"));
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={[FILL, { zIndex: 2 }]} pointerEvents="none">
        <LiveFxOverlay fx={hostFx} includePoster={false} />
      </View>
      <LiveEffectsOverlay />
      <PosterGestureLayer />
      <GiftAnimationOverlay
        trigger={
          session.lastGift
            ? {
                id: session.lastGift.id,
                giftKey: session.lastGift.giftKey,
                fromName: session.lastGift.senderName,
                at: session.lastGift.at,
              }
            : null
        }
      />
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.topLeft, layout.narrow && { paddingRight: 88 }]}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTime}>{fmtDuration(session.durationSec)}</Text>
          </View>
          <Press
            onPress={() => setViewersOpen(true)}
            style={styles.viewersPill}
            accessibilityLabel={t("live.viewersSheetTitle")}
          >
            <Eye size={12} color="#fff" />
            <Text style={styles.viewersTxt}>{viewers}</Text>
          </Press>
        </View>
        <View style={styles.topRight}>
          <Press
            onPress={() => setProductsOpen(true)}
            style={[styles.circleBtn, { width: layout.iconSm, height: layout.iconSm, borderRadius: layout.iconSm / 2 }]}
            accessibilityLabel={t("live.openProducts")}
          >
            <Package size={layout.compact ? 14 : 16} color="#fff" />
            {session.products.length > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{session.products.length}</Text>
              </View>
            ) : null}
          </Press>
          {onMinimize ? (
            <Press
              onPress={onMinimize}
              style={[styles.circleBtn, { width: layout.iconSm, height: layout.iconSm, borderRadius: layout.iconSm / 2 }]}
              accessibilityLabel={t("live.minimize")}
            >
              <Minimize2 size={layout.compact ? 14 : 16} color="#fff" />
            </Press>
          ) : null}
          <Press
            onPress={onEnd}
            style={[styles.endBtn, layout.narrow && { paddingHorizontal: 8 }]}
            accessibilityLabel={t("live.endLive")}
          >
            <X size={14} color="#fff" />
            {!layout.narrow ? (
              <Text style={styles.endTxt}>{t("live.endLiveShort", "Terminer")}</Text>
            ) : null}
          </Press>
        </View>
      </View>

      {battleActive && battle && fighters ? (
        <View pointerEvents="none" style={[styles.battleHud, { top: dock.hudTop }]}>
          <BattleScoreHud
            session={battle.session}
            remainingMs={remainingMs}
            left={fighters.left}
            right={fighters.right}
          />
        </View>
      ) : (
      <View
        pointerEvents="box-none"
        style={[styles.statsWrap, { top: insets.top + layout.statsTopExtra }]}
      >
        <View style={[styles.statsBar, layout.narrow && { maxWidth: "72%" }]}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t("live.salesShort", "Ventes")}</Text>
            <Text style={[styles.statValue, { fontSize: layout.s(13) }]}>{fmt(session.sales.revenue)}</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t("live.articlesShort", "Articles")}</Text>
            <Text style={[styles.statValue, { fontSize: layout.s(13) }]}>{session.sales.count}</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t("gifts.short")}</Text>
            <Text style={[styles.statValue, { fontSize: layout.s(13) }, session.gifts.count > 0 && { color: GOLD }]}>
              {fmt(session.gifts.sellerNet)}
            </Text>
          </View>
        </View>
        {!layout.compact ? (
          <View style={styles.socialRow}>
            {(["YT", "FB", "TT"] as const).map((p) => (
              <Press
                key={p}
                onPress={() =>
                  soon(t("live.restreamSoon", "Le restream {{platform}} se configure sur kidiplus.com", { platform: p }))
                }
                style={styles.socialPill}
              >
                <Radio size={11} color={NAVY} />
                <Text style={styles.socialTxt}>{p}</Text>
              </Press>
            ))}
          </View>
        ) : null}
      </View>
      )}

      {!battleActive ? (
      <View
        pointerEvents="box-none"
        style={[
          styles.rail,
          {
            bottom: hostRailBottom(insets.bottom),
            gap: layout.railGap,
          },
        ]}
      >
        <RailBtn size={layout.icon} onPress={() => setFiltersOpen(true)} accent={filtersOpen || activeLens.lensId !== "none"}>
          <Sparkles size={layout.compact ? 17 : 19} color={filtersOpen || activeLens.lensId !== "none" ? NAVY : "#fff"} strokeWidth={1.9} />
        </RailBtn>
        <RailBtn size={layout.icon} onPress={onToggleMic} off={!micOn}>
          {micOn ? (
            <Mic size={layout.compact ? 17 : 19} color="#fff" strokeWidth={1.9} />
          ) : (
            <MicOff size={layout.compact ? 17 : 19} color="#fff" strokeWidth={1.9} />
          )}
        </RailBtn>
        <RailBtn size={layout.icon} onPress={onToggleCam} off={!camOn}>
          {camOn ? (
            <Video size={layout.compact ? 17 : 19} color="#fff" strokeWidth={1.9} />
          ) : (
            <VideoOff size={layout.compact ? 17 : 19} color="#fff" strokeWidth={1.9} />
          )}
        </RailBtn>
        <RailBtn size={layout.icon} onPress={onFlip}>
          <RefreshCw size={layout.compact ? 17 : 19} color="#fff" strokeWidth={1.9} />
        </RailBtn>
        <RailBtn size={layout.icon} onPress={() => setBattleOpen(true)}>
          <Swords size={layout.compact ? 17 : 19} color="#fff" strokeWidth={1.9} />
        </RailBtn>
        <RailBtn size={layout.icon} onPress={() => setModsOpen(true)}>
          <Shield size={layout.compact ? 17 : 19} color="#fff" strokeWidth={1.9} />
        </RailBtn>
        <Press
          onPress={() => setAddOpen(true)}
          style={[
            styles.plusBtn,
            {
              width: layout.icon,
              height: layout.icon,
              borderRadius: layout.icon / 2,
            },
          ]}
        >
          <Plus size={layout.compact ? 20 : 22} color={NAVY} strokeWidth={2.6} />
        </Press>
      </View>
      ) : null}

      {!battleActive ? (
      <View
        pointerEvents="none"
        style={[
          styles.auctionStack,
          {
            top: insets.top + hostAuctionTopExtra({
              layout: featuredLayout.layout,
              featuredTopExtra: layout.featuredTopExtra,
              compact: layout.compact,
            }),
            ...hostAuctionGutter({
              layout: featuredLayout.layout,
              icon: layout.icon,
              portraitCardWidth: HOST_PORTRAIT_CARD_WIDTH,
            }),
          },
        ]}
      >
        <AuctionFinalCountdown
          secondsLeft={session.timeLeft}
          active={!!session.auction && !reveal}
          embedded
          compact={layout.compact}
          suddenDeath={suddenDeathMode}
        />
        {flash ? (
          <View style={styles.sdPill}>
            <Text style={styles.sdTxt}>{t("auction.suddenDeath.flash")}</Text>
          </View>
        ) : null}
        <BidPulseFlash
          text={
            session.lastBid
              ? `${session.lastBid.bidderName} · ${fmt(session.lastBid.amount)}`
              : null
          }
          pulseKey={session.lastBid?.ts ?? 0}
          embedded
          lower={bidLower}
        />
      </View>
      ) : null}
      <WinnerReveal reveal={reveal} onDone={() => setReveal(null)} />

      {/* Layout (vertical/horizontal) is display-only — it never restarts the sale. */}
      {featured && !battleActive ? (
        <View
          pointerEvents="box-none"
          style={
            featuredLayout.layout === "landscape"
              ? [
                  styles.featuredLand,
                  {
                    top: insets.top + layout.featuredTopExtra + (layout.compact ? 0 : 28),
                    right: hostFeaturedRight(),
                  },
                ]
              : [
                  styles.featuredPort,
                  { top: insets.top + layout.featuredTopExtra, right: hostFeaturedRight() },
                ]
          }
        >
          <HostFeaturedCard
            key={featured.id}
            name={featured.name}
            imageUrl={featured.image_url}
            priceLabel={fmt(Number(featured.price ?? featured.start_price))}
            stock={featured.stock}
            mode={featured.mode}
            status={featured.status}
            auctionLive={!!auctionOnFeatured}
            secondsLeft={auctionOnFeatured ? session.timeLeft : null}
            busy={busyId === featured.id}
            layout={featuredLayout.layout}
            onChangeLayout={featuredLayout.save}
            onSell={() => void runFeaturedAction(featured)}
            onOpenProducts={() => {
              session.setFeaturedId(featured.id);
              setProductsOpen(true);
            }}
          />
        </View>
      ) : null}

      {battleActive ? (
        <View pointerEvents="box-none" style={[styles.battleCards, { top: dock.cardTop }]}>
          <BattleFeaturedRow
            own={featured}
            peer={peerFeatured}
            currency={currency}
            ownSecondsLeft={auctionOnFeatured ? session.timeLeft : 0}
            onManageOwn={() => setProductsOpen(true)}
            onStartOwn={featured ? () => void runFeaturedAction(featured) : undefined}
            onOpenPeer={() => setPeerOpen(true)}
          />
        </View>
      ) : null}
      <BattlePeerProductSheet
        open={peerOpen && !!peerFeatured}
        onClose={() => setPeerOpen(false)}
        product={peerFeatured}
        currency={currency}
      />

      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { top: insets.top + 118 }]}>
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      ) : null}

      {!filtersOpen ? (
      <KeyboardAvoidingView
        pointerEvents="box-none"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.bottomWrap}
      >
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 10, paddingRight: battleActive ? 64 : 64 }]}>
          <View pointerEvents="none" style={styles.chatFeed}>
            {session.chat.slice(-5).map((m) => (
              <View key={m.id} style={styles.chatBubble}>
                {m.system ? (
                  <Text style={styles.chatSys}>{m.text}</Text>
                ) : (
                  <Text style={styles.chatLine}>
                    <Text style={styles.chatUser}>{m.user}</Text>
                    <Text style={styles.chatText}>  {m.text}</Text>
                  </Text>
                )}
              </View>
            ))}
          </View>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t("live.chatPlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => {
                session.sendChat(draft);
                setDraft("");
                Keyboard.dismiss();
              }}
            />
            <Press
              onPress={() => {
                session.sendChat(draft);
                setDraft("");
                Keyboard.dismiss();
              }}
              style={styles.sendBtn}
              accessibilityLabel={t("live.sendMessage")}
            >
              <Send size={17} color="#fff" />
            </Press>
          </View>
        </View>
      </KeyboardAvoidingView>
      ) : null}

      <Modal visible={productsOpen} animationType="slide" transparent onRequestClose={() => setProductsOpen(false)}>
        <View style={styles.sheetRoot}>
          <Press haptic="none" onPress={() => setProductsOpen(false)} style={styles.sheetDim} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("live.products")}</Text>
              <Press onPress={() => setProductsOpen(false)} style={styles.sheetClose}>
                <X size={18} color={NAVY} />
              </Press>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {session.products.length === 0 ? (
                <Text style={styles.empty}>{t("broadcast.setup.readyHelp")}</Text>
              ) : (
                session.products.map((p) => (
                  <Press
                    key={p.id}
                    onPress={() => session.setFeaturedId(p.id)}
                    style={[styles.prodRow, featured?.id === p.id && styles.prodRowOn]}
                  >
                    {p.image_url ? (
                      <Image source={{ uri: p.image_url }} style={styles.prodImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.prodImg, styles.featuredPh]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prodName}>{p.name}</Text>
                      <Text style={styles.prodMeta}>
                        {p.mode === "auction"
                          ? `${fmt(p.start_price)} · ${p.timer_seconds}s · ${p.status}`
                          : `${fmt(p.price)} · stock ${p.stock} · ${p.status}`}
                      </Text>
                    </View>
                    <Press
                      onPress={() => void runFeaturedAction(p)}
                      style={styles.prodCta}
                      disabled={busyId === p.id || (session.auction != null && session.auction.productId !== p.id && p.mode === "auction")}
                    >
                      <Text style={styles.prodCtaTxt}>{p.mode === "auction" ? t("live.startNext") : t("live.listForSale")}</Text>
                    </Press>
                  </Press>
                ))
              )}
            </ScrollView>
            <Press onPress={() => { setProductsOpen(false); setAddOpen(true); }} style={styles.addRow}>
              <Plus size={16} color={NAVY} />
              <Text style={styles.addRowTxt}>{t("live.addProduct")}</Text>
            </Press>
          </View>
        </View>
      </Modal>

      <Modal visible={viewersOpen} animationType="slide" transparent onRequestClose={() => setViewersOpen(false)}>
        <View style={styles.sheetRoot}>
          <Press haptic="none" onPress={() => setViewersOpen(false)} style={styles.sheetDim} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("live.viewersSheetTitle")}</Text>
              <Press onPress={() => setViewersOpen(false)} style={styles.sheetClose}>
                <X size={18} color={NAVY} />
              </Press>
            </View>
            {session.presentViewers.length === 0 ? (
              <Text style={styles.empty}>{t("live.viewersEmpty")}</Text>
            ) : (
              session.presentViewers.map((v) => (
                <Text key={v.identity} style={styles.viewerName}>
                  {v.name}
                </Text>
              ))
            )}
          </View>
        </View>
      </Modal>

      <AddProductSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(p) => {
          void addProducts([p]);
        }}
        onPickFromShop={() => {
          setAddOpen(false);
          setShopOpen(true);
        }}
        currency={currency}
      />
      <ShopPickerSheet
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        onConfirm={(items) => {
          void addProducts(items);
        }}
        userId={user?.id}
        currency={currency}
      />
      {user?.id ? (
        <>
          <ModeratorsSheet
            open={modsOpen}
            onClose={() => setModsOpen(false)}
            liveId={liveId}
            hostId={user.id}
            presentIds={session.presentViewers.map((p) => ({ id: p.identity, name: p.name }))}
            onToast={setToast}
          />
          <BattleInviteSheet
            open={battleOpen}
            onClose={() => setBattleOpen(false)}
            liveId={liveId}
            excludeSellerId={user.id}
            onToast={setToast}
          />
        </>
      ) : null}

      <FiltersCarousel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        hint={t(
          "broadcast.filters.liveHint",
          "Le filtre et l’image sont visibles pour tes spectateurs.",
        )}
      />

      {battleActive ? (
        <BattleHostBar
          micOn={micOn}
          camOn={camOn}
          filtersActive={filtersOpen || activeLens.lensId !== "none"}
          onToggleMic={onToggleMic}
          onToggleCam={onToggleCam}
          onFlip={onFlip}
          onLeave={leaveBattle}
          onOpenModerators={() => setModsOpen(true)}
          onOpenProducts={() => setProductsOpen(true)}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      ) : null}

      {introOn ? (
        <DefiPlusIntroOverlay
          active
          startsAt={introStartsAt}
          leftName={fighters?.left.displayName}
          rightName={fighters?.right.displayName}
        />
      ) : null}

      <BattleSuddenDeathOverlay
        active={
          battleActive &&
          (!!battle?.session.sudden_death || battle?.session.status === "sudden_death")
        }
      />

      <BattleResultOverlay
        open={resultOpen}
        battle={battle ?? null}
        selfSellerId={user?.id}
        onDone={() => {
          if (battle?.session.id) setDismissedResultId(battle.session.id);
        }}
        onRematch={requestRematch}
      />

      {incoming ? (
        <View style={styles.incomingWrap}>
          <View style={styles.incomingCard}>
            <Text style={styles.incomingTitle}>
              {t("battle.incoming.title", { name: incoming.fromName })}
            </Text>
            <Text style={styles.incomingBody}>
              {incoming.durationSec <= 90
                ? t("battle.incoming.bodyDemo")
                : t("battle.incoming.body", { count: Math.round(incoming.durationSec / 60) })}
            </Text>
            <Text style={styles.incomingAsk}>{t("battle.incoming.ask")}</Text>
            <View style={styles.incomingBtns}>
              <Press
                onPress={() => {
                  if (incomingBusy) return;
                  setIncomingBusy(true);
                  void battleDecline(incoming.id).finally(() => setIncomingBusy(false));
                }}
                style={styles.incomingNo}
              >
                <Text style={styles.incomingNoTxt}>{t("battle.incoming.decline")}</Text>
              </Press>
              <Press
                onPress={() => {
                  if (incomingBusy) return;
                  setIncomingBusy(true);
                  void battleAccept(incoming.id)
                    .then(async (res) => {
                      if (!res.ok) {
                        setToast(res.error ?? t("battle.invite.failed"));
                        return;
                      }
                      await onBattleAccepted?.();
                      setToast(t("battle.brand"));
                    })
                    .finally(() => setIncomingBusy(false));
                }}
                style={styles.incomingYes}
              >
                <Text style={styles.incomingYesTxt}>{t("battle.incoming.accept")}</Text>
              </Press>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RailBtn({
  children,
  onPress,
  off,
  accent,
  size = 44,
}: {
  children: ReactNode;
  onPress: () => void;
  off?: boolean;
  accent?: boolean;
  size?: number;
}) {
  return (
    <Press
      onPress={onPress}
      style={[
        styles.railBtn,
        { width: size, height: size, borderRadius: size / 2 },
        off && styles.railOff,
        accent && styles.railAccent,
      ]}
    >
      {children}
    </Press>
  );
}

const styles = StyleSheet.create({
  root: { ...FILL, zIndex: 20 },
  top: {
    position: "absolute",
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 10,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 110 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(220,30,40,0.95)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minHeight: 28,
    minWidth: 0,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveTime: { color: "#fff", fontWeight: "800", fontSize: 11, fontVariant: ["tabular-nums"] },
  viewersPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minHeight: 28,
    minWidth: 0,
  },
  viewersTxt: { color: "#fff", fontWeight: "700", fontSize: 11, fontVariant: ["tabular-nums"] },
  circleBtn: {
    width: 36,
    height: 36,
    minWidth: 36,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeTxt: { color: NAVY, fontSize: 9, fontWeight: "800" },
  endBtn: {
    height: 36,
    minHeight: 36,
    minWidth: 0,
    borderRadius: 999,
    backgroundColor: "rgba(220,30,40,0.95)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 4,
  },
  endTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  statsWrap: {
    position: "absolute",
    left: 12,
    right: 124,
    zIndex: 9,
    gap: 6,
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stat: { flex: 1 },
  statLabel: { color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  statValue: { color: "#fff", fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  statDiv: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 8 },
  socialRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  socialPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 22,
    minWidth: 0,
  },
  socialTxt: { color: NAVY, fontSize: 10, fontWeight: "900" },
  featuredPort: {
    position: "absolute",
    zIndex: 14,
    alignItems: "flex-end",
  },
  featuredLand: {
    position: "absolute",
    left: 12,
    zIndex: 14,
  },
  rail: {
    position: "absolute",
    right: 10,
    zIndex: 12,
    alignItems: "center",
    gap: 10,
  },
  railBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: RAIL_BG,
    borderWidth: 1,
    borderColor: RAIL_BORDER,
  },
  railOff: { backgroundColor: "rgba(216,44,52,0.82)" },
  railAccent: { backgroundColor: GOLD, borderColor: "rgba(255,255,255,0.45)" },
  plusBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: GOLD,
    marginTop: 4,
  },
  auctionStack: {
    position: "absolute",
    zIndex: 55,
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 0,
  },
  sdPill: {
    maxWidth: "92%",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#E5393F",
    alignItems: "center",
  },
  sdTxt: { color: "#fff", fontWeight: "900", fontSize: 13, textAlign: "center" },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    zIndex: 39,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
  },
  toastTxt: { color: "#fff", fontWeight: "700", fontSize: 13, textAlign: "center" },
  bottomWrap: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 13 },
  bottom: { paddingLeft: 12, paddingRight: 64, gap: 8 },
  chatFeed: { gap: 4, alignItems: "flex-start" },
  chatBubble: {
    maxWidth: "88%",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chatSys: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  chatLine: { color: "#fff", fontSize: 13 },
  chatUser: { color: GOLD, fontWeight: "800" },
  chatText: { color: "#fff" },
  composer: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    paddingHorizontal: 16,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetDim: { ...FILL, backgroundColor: "rgba(0,0,0,0.45)", minHeight: 0, minWidth: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: "78%",
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { color: NAVY, fontSize: 18, fontWeight: "800" },
  sheetClose: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  empty: { color: "#6B7289", fontSize: 13, paddingVertical: 12 },
  prodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    minHeight: 0,
    minWidth: 0,
  },
  prodRowOn: { backgroundColor: "rgba(232,185,59,0.12)", borderRadius: 12, paddingHorizontal: 6 },
  prodImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#eee" },
  featuredPh: { backgroundColor: "rgba(255,255,255,0.12)" },
  prodName: { color: NAVY, fontWeight: "800", fontSize: 14 },
  prodMeta: { color: "#6B7289", fontSize: 11, marginTop: 2 },
  prodCta: {
    minHeight: 32,
    minWidth: 0,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  prodCtaTxt: { color: NAVY, fontWeight: "800", fontSize: 11 },
  addRow: {
    marginTop: 8,
    height: 44,
    borderRadius: 999,
    backgroundColor: GOLD,
    flexDirection: "row",
    gap: 6,
  },
  addRowTxt: { color: NAVY, fontWeight: "800" },
  viewerName: { color: NAVY, fontSize: 15, fontWeight: "600", paddingVertical: 8 },
  incomingWrap: {
    ...FILL,
    zIndex: 60,
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  incomingCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  incomingTitle: { color: NAVY, fontSize: 18, fontWeight: "900" },
  incomingBody: { color: "#6B7289", fontSize: 14 },
  incomingAsk: { color: NAVY, fontSize: 14, fontWeight: "700", marginTop: 4 },
  incomingBtns: { flexDirection: "row", gap: 8, marginTop: 8 },
  incomingNo: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#F2F3F7",
  },
  incomingNoTxt: { color: NAVY, fontWeight: "800" },
  incomingYes: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  incomingYesTxt: { color: NAVY, fontWeight: "900" },
  battleHud: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 34,
  },
  battleCards: {
    position: "absolute",
    left: 4,
    right: 4,
    zIndex: 32,
    height: 76,
  },
});
