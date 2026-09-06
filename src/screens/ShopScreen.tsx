import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Archive,
  ChevronRight,
  Clapperboard,
  Download,
  ImagePlus,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Radio,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  Trash2,
  Users,
  Video,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { AuthInput } from "../components/AuthInput";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";
import { pickImageFromLibrary, type PickedImage } from "../lib/pick-image";
import {
  archiveShopProduct,
  createShopProduct,
  formatShopError,
  listMyShopProducts,
  listSellerActiveShopProducts,
  reactivateShopProduct,
  updateShopProduct,
  uploadShopProductImage,
} from "../lib/shop";
import { countSellerLives, fetchLiveById, fetchSellerLives, isReplayPlayable, type SellerLiveEntry } from "../lib/lives";
import {
  countVitrinePostsByUser,
  deleteVitrinePost,
  fetchVitrinePostsByUser,
  looksLikeVideo,
  type VitrineFeedPost,
} from "../lib/vitrine";
import { fetchSellerPublic, uploadBanner, type SellerPublic } from "../lib/seller";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { ReferredBadge } from "../components/ReferredBadge";
import { ReportSheet } from "../components/moderation/ReportSheet";
import { listSellerReviews, type SellerReview } from "../lib/reviews";
import { useFollow } from "../lib/follows";
import { GOLD, NAVY, initials } from "../theme";
import { isHttpUrl } from "../lib/storage";
import { type ShopItem } from "../mock/account";
import { ProductOptionsFields } from "../components/shop/ProductOptionsFields";
import type { ProductCondition } from "../lib/live-product-options";
import {
  deleteLiveReplay,
  playableReplayUrl,
  replayDaysLeft,
} from "../lib/live-replay";
import { downloadLiveReplay } from "../lib/live-replay-download";

type ShopTab = "boutique" | "lives" | "vitrine" | "avis";
type ReplayOpen = { url: string; title: string; liveId: string };

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

type FormPhoto = { uri: string; path?: string | null; picked?: PickedImage | null };

type FormState = {
  item: ShopItem | null;
  name: string;
  price: string;
  stock: string;
  description: string;
  photos: FormPhoto[];
  brand: string;
  condition: ProductCondition | null;
  colors: string[];
  sizes: string[];
};

function emptyForm(): FormState {
  return {
    item: null,
    name: "",
    price: "",
    stock: "1",
    description: "",
    photos: [],
    brand: "",
    condition: null,
    colors: [],
    sizes: [],
  };
}

export function ShopScreen({
  sellerId,
  sellerName,
  initialTab,
  focusLiveId,
}: {
  sellerId?: string;
  sellerName?: string;
  initialTab?: ShopTab;
  focusLiveId?: string;
} = {}) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const { user, becomeSeller, guestMode, openAuth } = useAuth();
  const { openOverlay, openLive, closeOverlay, setTab, setPendingVitrinePostId } = useNav();
  const scrollRef = useRef<ScrollView>(null);
  const focusedReplay = useRef<string | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const own = !sellerId || sellerId === user?.id;
  const followTargetId = !own && sellerId ? sellerId : null;
  const follow = useFollow(followTargetId);
  const [shopTab, setShopTab] = useState<ShopTab>(initialTab ?? "boutique");
  const [seller, setSeller] = useState<SellerPublic | null>(null);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [lives, setLives] = useState<SellerLiveEntry[]>([]);
  const [vitrinePosts, setVitrinePosts] = useState<VitrineFeedPost[]>([]);
  const [livesCount, setLivesCount] = useState(0);
  const [vitrineCount, setVitrineCount] = useState(0);
  const [replayOpen, setReplayOpen] = useState<ReplayOpen | null>(null);
  const [gridY, setGridY] = useState(0);

  const reload = async () => {
    const id = own ? user?.id : sellerId;
    if (!id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const rows = own ? await listMyShopProducts(id) : await listSellerActiveShopProducts(id);
    setItems(rows);
    const [pub, liveRows, vCount, liveCount, vPosts, revs] = await Promise.all([
      fetchSellerPublic(id),
      fetchSellerLives(id),
      countVitrinePostsByUser(id),
      countSellerLives(id),
      fetchVitrinePostsByUser(id),
      listSellerReviews(id),
    ]);
    setSeller(pub);
    setLives(liveRows);
    setVitrineCount(vCount);
    setLivesCount(liveCount);
    setVitrinePosts(vPosts);
    setReviews(revs);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sellerId, own]);

  useEffect(() => {
    if (initialTab) setShopTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!own || shopTab !== "lives") return;
    const iv = setInterval(() => {
      void reload();
    }, 8000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own, shopTab, user?.id, sellerId]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const openNew = () => {
    const next = emptyForm();
    next.price = user?.walletCurrency === "XOF" ? "1000" : "20";
    setForm(next);
  };

  const openEdit = (item: ShopItem) => {
    const paths = item.imagePaths?.length ? item.imagePaths : item.imagePath ? [item.imagePath] : [];
    setForm({
      item,
      name: item.name,
      price: item.priceValue != null ? String(item.priceValue) : "",
      stock: String(item.stock),
      description: item.description ?? "",
      brand: item.brand ?? "",
      condition: item.condition ?? null,
      colors: item.colors ?? [],
      sizes: item.sizes ?? [],
      photos: paths.length
        ? paths.map((p, i) => ({ uri: i === 0 ? item.image : p, path: p }))
        : item.image
          ? [{ uri: item.image, path: item.imagePath }]
          : [],
    });
  };

  const pickPhoto = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    if (!picked.blob.type.startsWith("image/") && picked.contentType && !picked.contentType.startsWith("image/")) {
      flash(t("shop.imageOnly"));
      return;
    }
    try {
      if (picked.blob.size > 5 * 1024 * 1024) {
        flash(t("shop.imageTooBig"));
        return;
      }
    } catch {
      /* ignore */
    }
    setForm((prev) => {
      if (!prev) return prev;
      if (prev.photos.length >= 5) {
        flash(t("shop.maxPhotos", { defaultValue: "5 photos max" }));
        return prev;
      }
      return { ...prev, photos: [...prev.photos, { uri: picked.preview, picked }] };
    });
  };

  const save = async () => {
    if (!user?.id || !form) return;
    const name = form.name.trim();
    const price = Math.max(0, Number(form.price.replace(",", ".")) || 0);
    const stock = Math.max(0, Math.floor(Number(form.stock) || 0));
    if (!name) {
      flash(t("shop.nameRequired"));
      return;
    }
    if (price <= 0) {
      flash(t("shop.priceRequired"));
      return;
    }
    setSaving(true);
    try {
      if (!user.isSeller) await becomeSeller();
      let imagePaths: string[] = [];
      for (const photo of form.photos) {
        if (photo.picked) {
          imagePaths.push(await uploadShopProductImage(user.id, photo.picked));
        } else if (photo.path) {
          imagePaths.push(photo.path);
        }
      }
      imagePaths = imagePaths.slice(0, 5);
      if (!form.item && imagePaths.length === 0) {
        flash(t("shop.needPhoto"));
        setSaving(false);
        return;
      }
      const currency = form.item?.currency ?? user.walletCurrency ?? "EUR";
      if (form.item) {
        await updateShopProduct(form.item.id, {
          name,
          description: form.description,
          price,
          stock,
          imagePaths: imagePaths.length ? imagePaths : undefined,
          brand: form.brand,
          condition: form.condition,
          colors: form.colors,
          sizes: form.sizes,
        });
        flash(t("shop.updated"));
      } else {
        await createShopProduct(user.id, {
          name,
          description: form.description,
          price,
          currency,
          stock,
          imagePaths,
          brand: form.brand,
          condition: form.condition,
          colors: form.colors,
          sizes: form.sizes,
        });
        flash(t("shop.added"));
      }
      setForm(null);
      setLoading(true);
      await reload();
    } catch (err) {
      const msg = formatShopError(err);
      flash(msg === "image_too_big" ? t("shop.imageTooBig") : msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: ShopItem) => {
    try {
      if (item.active) {
        await archiveShopProduct(item.id);
        flash(t("shop.archived"));
      } else {
        await reactivateShopProduct(item.id);
        flash(t("shop.reactivated"));
      }
      await reload();
    } catch (err) {
      flash(formatShopError(err));
    }
  };

  const pickBanner = async () => {
    if (!own || !user?.id) return;
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    try {
      const url = await uploadBanner(user.id, picked);
      setSeller((prev) => (prev ? { ...prev, bannerUrl: url } : prev));
      flash(t("shop.bannerUpdated", { defaultValue: "Bannière mise à jour" }));
    } catch (err) {
      flash(formatShopError(err));
    }
  };

  const featured = useMemo(() => items.filter((p) => p.active).slice(0, 8), [items]);
  const orderedLives = useMemo(() => {
    const rank = (s: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
    return [...lives].sort((a, b) => rank(a.status) - rank(b.status));
  }, [lives]);
  const displayName = seller?.displayName || sellerName || user?.displayName || t("shop.title");
  const handle = seller?.handle || user?.handle || "";
  const avatar = seller?.avatarUrl || (own ? user?.avatarUrl : null);
  const banner = seller?.bannerUrl || (own ? user?.bannerUrl : null);
  const bio = seller?.bio || user?.bio;
  const followers = seller?.followers ?? user?.followers ?? 0;
  const shopTitle = `${displayName} Boutique`;

  const goTab = (next: ShopTab) => {
    if (next === "lives" && !own) {
      flash(t("sellerProfile.livesOwnerOnly"));
      return;
    }
    setShopTab(next);
  };

  const scrollToCatalog = () => {
    setShopTab("boutique");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, gridY - 12), animated: true });
    });
  };

  const openReplayEntry = async (row: SellerLiveEntry) => {
    if (row.status === "live") {
      const stream = await fetchLiveById(row.id);
      if (stream) {
        closeOverlay();
        openLive(stream);
      }
      return;
    }
    if (!isReplayPlayable(row)) return;
    const url = await playableReplayUrl(row.id, {
      replay_status: (row.replay_status as "ready") ?? "ready",
      replay_url: row.replay_url,
      replay_expires_at: row.replay_expires_at,
    });
    if (!url) {
      flash(t("broadcast.replay.openFailed"));
      return;
    }
    setReplayOpen({ url, title: row.title, liveId: row.id });
  };

  useEffect(() => {
    if (!focusLiveId) return;
    const row = lives.find((l) => l.id === focusLiveId);
    if (!row) return;
    setShopTab("lives");
    if (!isReplayPlayable(row) || focusedReplay.current === focusLiveId) return;
    focusedReplay.current = focusLiveId;
    void openReplayEntry(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLiveId, lives]);

  const confirmDeleteReplay = (liveId: string) => {
    Alert.alert(t("broadcast.replay.delete"), t("broadcast.replay.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("broadcast.replay.delete"),
        style: "destructive",
        onPress: () => {
          void deleteLiveReplay(liveId).then((res) => {
            if (!res.ok) {
              flash(t("broadcast.replay.deleteFailed"));
              return;
            }
            flash(t("broadcast.replay.deleted"));
            if (replayOpen?.liveId === liveId) setReplayOpen(null);
            setLives((prev) =>
              prev.map((r) =>
                r.id === liveId
                  ? { ...r, replay_url: null, replay_status: "expired", replay_expires_at: null }
                  : r,
              ),
            );
          });
        },
      },
    ]);
  };

  const confirmDeleteVitrine = (postId: string) => {
    Alert.alert(t("vitrine.delete"), t("vitrine.deleteOwnHint"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("vitrine.deleteConfirm"),
        style: "destructive",
        onPress: () => {
          void deleteVitrinePost(postId).then((ok) => {
            if (!ok) {
              flash(t("vitrine.deleteFail"));
              return;
            }
            flash(t("vitrine.deleted"));
            setVitrinePosts((prev) => prev.filter((p) => p.id !== postId));
            setVitrineCount((n) => Math.max(0, n - 1));
          });
        },
      },
    ]);
  };

  const openVitrinePost = (postId: string) => {
    setPendingVitrinePostId(postId);
    closeOverlay();
    setTab("vitrine");
  };

  if (form && own) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <OverlayHeader
          title={form.item ? t("shop.editItem") : t("shop.add")}
          onBack={() => setForm(null)}
          backLabel={t("common.back")}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {form.photos.map((p, i) => (
                <Press
                  key={`${p.uri}-${i}`}
                  onPress={() =>
                    setForm((prev) =>
                      prev ? { ...prev, photos: prev.photos.filter((_, j) => j !== i) } : prev,
                    )
                  }
                  style={{ minHeight: 0 }}
                >
                  <Image source={{ uri: p.uri }} style={styles.coverThumb} contentFit="cover" />
                </Press>
              ))}
              {form.photos.length < 5 ? (
                <Press onPress={() => void pickPhoto()} style={{ minHeight: 0, alignItems: "stretch" }}>
                  <Glass tone={dark ? "dark" : "light"} intensity={32} radius={18} elevated={false}>
                    <View style={styles.coverEmptySmall}>
                      <ImagePlus size={22} color={GOLD} />
                      <Text style={{ color: colors.mutedForeground, fontWeight: "700", marginTop: 6, fontSize: 12 }}>
                        {t("shop.pickPhoto")} ({form.photos.length}/5)
                      </Text>
                    </View>
                  </Glass>
                </Press>
              ) : null}
            </View>
            <AuthInput label={t("shop.name")} value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
            <AuthInput
              label={t("shop.price")}
              value={form.price}
              onChangeText={(price) => setForm({ ...form, price })}
              keyboardType="decimal-pad"
            />
            <AuthInput
              label={t("shop.stock")}
              value={form.stock}
              onChangeText={(stock) => setForm({ ...form, stock })}
              keyboardType="number-pad"
            />
            <AuthInput
              label={t("shop.description")}
              value={form.description}
              onChangeText={(description) => setForm({ ...form, description })}
              multiline
            />
            <ProductOptionsFields
              brand={form.brand}
              condition={form.condition}
              colors={form.colors}
              sizes={form.sizes}
              onBrand={(brand) => setForm({ ...form, brand })}
              onCondition={(condition) => setForm({ ...form, condition })}
              onColors={(colors) => setForm({ ...form, colors })}
              onSizes={(sizes) => setForm({ ...form, sizes })}
            />
            <GoldButton
              label={saving ? t("common.loading") : t("common.save")}
              onPress={() => void save()}
              disabled={saving}
            />
          </ScrollView>
        </KeyboardAvoidingView>
        <MockBanner text={toast} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: "#F6ECD9" }]}>
      <OverlayHeader title={own ? t("shop.title") : shopTitle} />
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={styles.hero}>
          {isHttpUrl(banner) ? (
            <Image source={{ uri: banner }} style={FILL} contentFit="cover" />
          ) : null}
          <LinearGradient
            colors={
              banner
                ? ["rgba(16,22,43,0.05)", "rgba(246,236,217,0.55)", "rgba(228,204,166,0.88)"]
                : ["rgba(246,236,217,0.2)", "rgba(238,221,191,0.15)", "rgba(228,204,166,0.35)"]
            }
            style={FILL}
            pointerEvents="none"
          />
          {own ? (
            <Press onPress={() => void pickBanner()} style={styles.bannerChip}>
              <ImagePlus size={13} color="#fff" />
              <Text style={styles.bannerChipTxt}>
                {banner ? t("shop.bannerEdit") : t("shop.bannerAdd")}
              </Text>
            </Press>
          ) : null}
          <View style={styles.heroInner}>
            <View style={styles.avDisc}>
              {isHttpUrl(avatar) ? (
                <Image source={{ uri: avatar }} style={styles.heroAv} />
              ) : (
                <View style={[styles.heroAv, styles.heroAvFallback]}>
                  <Text style={{ color: NAVY, fontWeight: "900", fontSize: 26 }}>{initials(displayName).slice(0, 1)}</Text>
                </View>
              )}
              {own ? (
                <Press
                  onPress={() => openOverlay({ kind: "edit-profile" })}
                  style={styles.avEdit}
                  accessibilityLabel={t("profile.editProfile")}
                >
                  <Pencil size={13} color={NAVY} />
                </Press>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Text style={styles.heroTitle}>{shopTitle}</Text>
              {seller?.isVerified ? <VerifiedBadge /> : null}
              <ReferredBadge referred={seller?.isReferred || (!!own && user?.isReferred)} size={16} />
            </View>
            {handle ? <Text style={styles.heroHandle}>@{handle}</Text> : null}
            <Text style={styles.heroBio} numberOfLines={3}>
              {bio || "L'élégance, la qualité, pour vos petits trésors. 🤎"}
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat
            icon={<ShoppingBag size={16} color="#C8A24B" />}
            n={items.length}
            label={t("seller.stats.products")}
            onPress={() => goTab("boutique")}
          />
          <Stat icon={<Users size={16} color="#C8A24B" />} n={followers} label={t("seller.stats.followers")} />
          <Stat
            icon={<Video size={16} color="#C8A24B" />}
            n={livesCount}
            label={own ? t("shop.livesDone") : t("seller.stats.lives")}
            onPress={() => goTab("lives")}
          />
          <Stat
            icon={<Clapperboard size={16} color="#C8A24B" />}
            n={vitrineCount}
            label={t("seller.stats.vitrine")}
            onPress={() => goTab("vitrine")}
          />
        </View>

        {own ? (
          <View style={styles.actions}>
            <Press onPress={openNew} style={styles.addBtn}>
              <Plus size={16} color="#fff" />
              <Text style={styles.addBtnTxt}>{t("shop.addShort")}</Text>
            </Press>
            <Press onPress={() => openOverlay({ kind: "broadcast-setup", mode: "now" })} style={styles.liveBtn}>
              <Radio size={15} color="#fff" />
              <Text style={styles.addBtnTxt}>{t("shop.goLive")}</Text>
            </Press>
            <Press onPress={() => openOverlay({ kind: "edit-profile" })} style={styles.customizeBtn}>
              <SlidersHorizontal size={15} color={NAVY} />
              <Text style={styles.customizeTxt}>{t("shop.customize")}</Text>
            </Press>
          </View>
        ) : (
          <View style={styles.actions}>
            <Press
              onPress={() => {
                if (guestMode || !user) return openAuth();
                void follow.toggle();
              }}
              style={[styles.addBtn, follow.following && { backgroundColor: NAVY }]}
            >
              <Users size={16} color="#fff" />
              <Text style={styles.addBtnTxt}>
                {follow.following
                  ? t("follow.following", { defaultValue: "Abonné" })
                  : t("follow.follow", { defaultValue: "Suivre" })}
              </Text>
            </Press>
            <Press
              onPress={() => {
                if (guestMode || !user) return openAuth();
                if (!sellerId) return;
                openOverlay({
                  kind: "dm-chat",
                  target: {
                    otherId: sellerId,
                    otherName: displayName,
                    otherAvatarUrl: avatar,
                  },
                });
              }}
              style={styles.liveBtn}
            >
              <MessageCircle size={15} color="#fff" />
              <Text style={styles.addBtnTxt}>{t("profile.hero.message", { defaultValue: "Message" })}</Text>
            </Press>
            <Press
              onPress={() => {
                if (guestMode || !user) return openAuth();
                setReportOpen(true);
              }}
              style={[styles.liveBtn, { backgroundColor: "#374151" }]}
            >
              <Text style={styles.addBtnTxt}>{t("report.action")}</Text>
            </Press>
          </View>
        )}

        {!own ? (
          <View style={styles.tabStrip}>
            {(
              [
                ["boutique", t("seller.tabs.boutique")],
                ["vitrine", t("seller.tabs.vitrine")],
                ["lives", t("seller.tabs.lives")],
                ["avis", t("seller.tabs.avis")],
              ] as const
            ).map(([k, label]) => (
              <Press key={k} onPress={() => goTab(k)} style={styles.tabBtn}>
                <Text style={[styles.tabTxt, shopTab === k && styles.tabTxtOn, k === "lives" && styles.tabTxtLocked]}>
                  {label}
                </Text>
                {shopTab === k ? <View style={styles.tabUnderline} /> : null}
              </Press>
            ))}
          </View>
        ) : null}

        {loading ? <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} /> : null}

        {!loading && shopTab === "boutique" ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {featured.length > 0 ? (
              <View>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>{t("shop.featured")}</Text>
                  <Press onPress={scrollToCatalog} style={styles.seeAll}>
                    <Text style={styles.seeAllTxt}>{t("shop.seeAll")}</Text>
                    <ChevronRight size={14} color="#6B7289" />
                  </Press>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                  {featured.map((item) => (
                    <View key={`f-${item.id}`} style={styles.featCard}>
                      <Press onPress={() => own && openEdit(item)} style={{ alignItems: "stretch", minHeight: 0 }}>
                        <View style={styles.featImgWrap}>
                          {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.featImg} contentFit="cover" />
                          ) : (
                            <View style={styles.featImg} />
                          )}
                          <View style={[styles.statusBadge, { backgroundColor: item.active ? "#12873F" : "#4A4A52" }]}>
                            <Text style={styles.statusTxt}>{item.active ? t("shop.active") : t("shop.archived")}</Text>
                          </View>
                        </View>
                        <Text numberOfLines={1} style={styles.featName}>{item.name}</Text>
                        <View style={styles.gridMeta}>
                          <Text style={styles.featPrice}>{item.price}</Text>
                          <Text style={styles.gridStock}>×{item.stock}</Text>
                        </View>
                      </Press>
                      {own ? (
                        <View style={styles.gridActions}>
                          <Press onPress={() => openEdit(item)} style={styles.gridAct}>
                            <Pencil size={12} color={NAVY} />
                          </Press>
                          <Press onPress={() => void toggleActive(item)} style={styles.gridAct}>
                            {item.active ? <Archive size={12} color={NAVY} /> : <Tag size={12} color={NAVY} />}
                          </Press>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <View onLayout={(e) => setGridY(e.nativeEvent.layout.y)}>
            <Text style={styles.sectionTitle}>{t("shop.allCategories")}</Text>
            {items.length === 0 ? (
              <Text style={{ color: "#6B7289", textAlign: "center", marginTop: 16 }}>
                {own ? t("shop.empty") : t("shop.emptyPickerSeller")}
              </Text>
            ) : (
              <View style={styles.prodGrid}>
                {items.map((item) => (
                  <View key={item.id} style={[styles.gridCard, !item.active && { opacity: 0.65 }]}>
                    <Press onPress={() => own && openEdit(item)} style={{ alignItems: "stretch", minHeight: 0 }}>
                      <View style={styles.gridImgWrap}>
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={styles.gridImg} contentFit="cover" />
                        ) : (
                          <View style={[styles.gridImg, { alignItems: "center", justifyContent: "center" }]}>
                            <ShoppingBag size={22} color="#9AA0B4" />
                          </View>
                        )}
                        <View style={[styles.statusBadge, { backgroundColor: item.active ? "#12873F" : "#4A4A52" }]}>
                          <Text style={styles.statusTxt}>{item.active ? "Actif" : "Archivé"}</Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={styles.gridName}>{item.name}</Text>
                      <View style={styles.gridMeta}>
                        <Text style={styles.gridPrice}>{item.price}</Text>
                        <Text style={styles.gridStock}>×{item.stock}</Text>
                      </View>
                    </Press>
                    {own ? (
                      <View style={styles.gridActions}>
                        <Press onPress={() => openEdit(item)} style={styles.gridAct}>
                          <Pencil size={12} color={NAVY} />
                        </Press>
                        <Press onPress={() => void toggleActive(item)} style={styles.gridAct}>
                          {item.active ? <Archive size={12} color={NAVY} /> : <Tag size={12} color={NAVY} />}
                        </Press>
                      </View>
                    ) : (
                      <Text style={styles.availableHint}>Disponible pendant les lives</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
            </View>
          </View>
        ) : null}

        {!loading && shopTab === "lives" && own ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {orderedLives.length === 0 ? (
              <Text style={{ color: "#6B7289", textAlign: "center", marginTop: 16 }}>
                {t("sellerProfile.livesEmpty")}
              </Text>
            ) : (
              <>
                <Text style={styles.hint}>{t("sellerProfile.swipeToDeleteReplay")}</Text>
                {orderedLives.map((l) => {
                  const isLive = l.status === "live";
                  const isScheduled = l.status === "scheduled";
                  const hasReplay = !isLive && !isScheduled && isReplayPlayable(l);
                  const daysLeft = hasReplay ? replayDaysLeft(l.replay_expires_at) : null;
                  const replayPending =
                    !isLive &&
                    !isScheduled &&
                    (l.replay_status === "recording" || l.replay_status === "processing");
                  const replayFailed = !isLive && !isScheduled && l.replay_status === "failed";
                  const clickable = isLive || hasReplay;
                  const sub = isLive
                    ? t("seller.liveNow")
                    : isScheduled
                      ? t("seller.activated")
                      : hasReplay
                        ? t("broadcast.replay.badgeDays", { days: daysLeft ?? 1 })
                        : replayPending
                          ? t("broadcast.replay.preparing")
                          : replayFailed
                            ? t("broadcast.replay.unavailable")
                            : t("seller.ended");
                  return (
                    <View key={l.id} style={[styles.liveCard, !hasReplay && !isLive ? { opacity: 0.7 } : null]}>
                      <Press
                        disabled={!clickable}
                        onPress={() => void openReplayEntry(l)}
                        style={styles.liveCardHit}
                      >
                        {l.cover_url ? (
                          <Image source={{ uri: l.cover_url }} style={styles.liveCover} contentFit="cover" />
                        ) : (
                          <View style={styles.liveCover} />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontWeight: "800", color: NAVY }}>
                            {l.title}
                          </Text>
                          <Text
                            style={{
                              color: hasReplay ? GOLD : "#6B7289",
                              marginTop: 2,
                              fontSize: 12,
                              fontWeight: hasReplay ? "700" : "500",
                            }}
                          >
                            {sub}
                          </Text>
                        </View>
                        {isLive ? <Radio size={16} color="#E5393F" /> : null}
                        {hasReplay ? (
                          <View style={styles.playDisc}>
                            <Play size={14} color="#fff" fill="#fff" />
                          </View>
                        ) : null}
                      </Press>
                      {hasReplay ? (
                        <Press
                          onPress={() => confirmDeleteReplay(l.id)}
                          style={styles.trashBtn}
                          accessibilityLabel={t("broadcast.replay.delete")}
                        >
                          <Trash2 size={14} color="#DC2626" />
                        </Press>
                      ) : null}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        ) : null}

        {!loading && shopTab === "avis" ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {reviews.length === 0 ? (
              <Text style={{ color: "#6B7289", textAlign: "center", marginTop: 16 }}>{t("reviews.empty")}</Text>
            ) : (
              reviews.map((r) => (
                <Glass key={r.id} tone="light" intensity={32} radius={16} elevated={false}>
                  <View style={{ padding: 12, gap: 4 }}>
                    <Text style={{ fontWeight: "800", color: NAVY }}>
                      {r.reviewer?.display_name || r.reviewer?.handle || "Acheteur"} · {"★".repeat(r.rating)}
                    </Text>
                    {r.comment ? <Text style={{ color: "#374151", fontSize: 13 }}>{r.comment}</Text> : null}
                    <Text style={{ color: "#6B7289", fontSize: 11 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </Glass>
              ))
            )}
          </View>
        ) : null}

        {!loading && shopTab === "vitrine" ? (
          <View style={{ paddingHorizontal: 14 }}>
            {own && vitrinePosts.length > 0 ? (
              <Text style={[styles.hint, { marginBottom: 8 }]}>{t("sellerProfile.vitrineHint")}</Text>
            ) : null}
            <View style={styles.vitrineGrid}>
            {vitrinePosts.length === 0 ? (
              <Text style={{ color: "#6B7289", textAlign: "center", width: "100%", marginTop: 16 }}>
                {t(own ? "sellerProfile.vitrineEmpty" : "sellerProfile.vitrineEmptyPublic")}
              </Text>
            ) : (
              vitrinePosts.map((p) => {
                const thumb = p.posterUrl || p.mediaUrls[0];
                return (
                  <View key={p.id} style={styles.vitrineCell}>
                    <Press onPress={() => openVitrinePost(p.id)} style={styles.vitrineHit}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.vitrineImg} contentFit="cover" />
                      ) : (
                        <View style={styles.vitrineImg} />
                      )}
                      {looksLikeVideo(p.mediaUrls[0] || "", p.mediaType) ? (
                        <View style={styles.vitrineBadge}>
                          <Play size={12} color="#fff" fill="#fff" />
                        </View>
                      ) : null}
                    </Press>
                    {own ? (
                      <Press
                        onPress={() => confirmDeleteVitrine(p.id)}
                        style={styles.vitrineTrash}
                        accessibilityLabel={t("vitrine.delete")}
                      >
                        <Trash2 size={14} color="#fff" />
                      </Press>
                    ) : null}
                  </View>
                );
              })
            )}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <ReplayModal
        replay={replayOpen}
        onClose={() => setReplayOpen(null)}
        onDownload={async () => {
          if (!replayOpen) return;
          try {
            const mode = await downloadLiveReplay(replayOpen.url, replayOpen.title);
            flash(
              mode === "shared" ? t("broadcast.replay.downloadShared") : t("broadcast.replay.downloadOpened"),
            );
          } catch {
            flash(t("broadcast.replay.downloadFailed"));
          }
        }}
        onDelete={own && replayOpen ? () => confirmDeleteReplay(replayOpen.liveId) : undefined}
      />
      <MockBanner text={toast} />
      {sellerId ? (
        <ReportSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="user"
          targetId={sellerId}
          defaultNote={displayName}
        />
      ) : null}
    </View>
  );
}

function Stat({
  n,
  label,
  onPress,
  icon,
}: {
  n: number | string;
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
}) {
  const value =
    typeof n === "string"
      ? n
      : n >= 1000
        ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "")}k`
        : String(n);
  return (
    <Press onPress={onPress} style={styles.stat}>
      {icon}
      <Text style={styles.statL} numberOfLines={2}>{label}</Text>
      <Text style={styles.statN}>{value}</Text>
    </Press>
  );
}

function ReplayModal({
  replay,
  onClose,
  onDownload,
  onDelete,
}: {
  replay: ReplayOpen | null;
  onClose: () => void;
  onDownload: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  if (!replay) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={styles.replayBar}>
          <Text numberOfLines={1} style={styles.replayTitle}>
            {replay.title || t("broadcast.replay.playerTitle")}
          </Text>
          <Press onPress={onDownload} style={styles.replayAction}>
            <Download size={16} color="#fff" />
            <Text style={styles.replayActionTxt}>{t("broadcast.replay.download")}</Text>
          </Press>
          {onDelete ? (
            <Press onPress={onDelete} style={[styles.replayAction, { backgroundColor: "rgba(220,38,38,0.9)" }]}>
              <Trash2 size={16} color="#fff" />
              <Text style={styles.replayActionTxt}>{t("broadcast.replay.delete")}</Text>
            </Press>
          ) : null}
          <Press onPress={onClose} style={styles.replayClose}>
            <Text style={{ color: "#111", fontWeight: "800" }}>{t("common.close")}</Text>
          </Press>
        </View>
        <ReplayPlayer uri={replay.url} />
      </View>
    </Modal>
  );
}

function ReplayPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  hero: { minHeight: 240, justifyContent: "flex-end", backgroundColor: "#EEDDBF" },
  heroInner: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 28, paddingTop: 36 },
  avDisc: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E8D28A",
    position: "relative",
  },
  avEdit: {
    position: "absolute",
    right: 4,
    bottom: -2,
    width: 32,
    height: 32,
    minHeight: 32,
    minWidth: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8D28A",
  },
  heroAv: { width: 118, height: 118, borderRadius: 59, backgroundColor: "#F6ECD9" },
  heroAvFallback: { alignItems: "center", justifyContent: "center" },
  heroTitle: { marginTop: 16, color: NAVY, fontWeight: "800", fontSize: 26, letterSpacing: -0.3, textAlign: "center" },
  heroHandle: { color: "#6B6046", fontWeight: "600", fontSize: 12, marginTop: 2 },
  heroBio: { marginTop: 8, color: "#4A4132", textAlign: "center", fontSize: 13.5, maxWidth: 280 },
  bannerChip: {
    position: "absolute",
    right: 12,
    top: 12,
    zIndex: 4,
    minHeight: 36,
    height: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "rgba(16,22,43,0.72)",
    flexDirection: "row",
    gap: 6,
  },
  bannerChipTxt: { color: "#fff", fontWeight: "800", fontSize: 11.5 },
  stats: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: -14,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(200,162,75,0.18)",
  },
  stat: { flex: 1, alignItems: "center", minHeight: 0, minWidth: 0, gap: 2 },
  statN: { fontWeight: "900", color: NAVY, fontSize: 15 },
  statL: { fontSize: 9, color: "#6B7289", fontWeight: "700", textAlign: "center" },
  actions: { paddingHorizontal: 16, marginTop: 12, flexDirection: "row", gap: 8 },
  addBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: NAVY,
    flexDirection: "row",
    gap: 6,
  },
  liveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#C8A24B",
    flexDirection: "row",
    gap: 6,
  },
  addBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  customizeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(16,22,43,0.12)",
  },
  customizeTxt: { color: NAVY, fontWeight: "800", fontSize: 12 },
  tabTxtLocked: { color: "#B0B4C0" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { fontWeight: "800", color: NAVY, fontSize: 17, marginBottom: 8 },
  seeAll: { minHeight: 32, flexDirection: "row", gap: 2, paddingHorizontal: 4 },
  seeAllTxt: { color: "#6B7289", fontWeight: "700", fontSize: 12 },
  hint: { color: "#6B7289", fontSize: 12, marginBottom: 4 },
  featCard: { width: 160, minHeight: 0, minWidth: 0, alignItems: "stretch", backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(16,22,43,0.08)", paddingBottom: 8 },
  featImgWrap: { width: 160, height: 160, backgroundColor: "#E8EAF1" },
  featImg: { width: 160, height: 160, backgroundColor: "#E8EAF1" },
  tabStrip: {
    flexDirection: "row",
    marginTop: 16,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(16,22,43,0.12)",
  },
  tabBtn: { flex: 1, minHeight: 44, minWidth: 0, paddingHorizontal: 4 },
  tabTxt: { fontWeight: "700", fontSize: 13, color: "#6B7289" },
  tabTxtOn: { color: NAVY },
  tabUnderline: { marginTop: 8, height: 2, width: "70%", backgroundColor: GOLD, borderRadius: 1 },
  featName: { marginTop: 6, paddingHorizontal: 8, fontWeight: "800", color: NAVY, fontSize: 12 },
  featPrice: { color: NAVY, fontWeight: "800", fontSize: 13 },
  prodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(16,22,43,0.08)",
    paddingBottom: 8,
  },
  gridImgWrap: { width: "100%", aspectRatio: 1, backgroundColor: "#EEE6D6" },
  gridImg: { width: "100%", height: "100%" },
  statusBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusTxt: { color: "#fff", fontSize: 9.5, fontWeight: "800", textTransform: "uppercase" },
  gridName: { marginTop: 8, paddingHorizontal: 8, fontWeight: "700", color: NAVY, fontSize: 12.5 },
  gridMeta: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, marginTop: 2 },
  gridPrice: { fontWeight: "800", color: NAVY, fontSize: 12.5 },
  gridStock: { color: "#6B7289", fontSize: 11 },
  gridActions: { flexDirection: "row", gap: 6, paddingHorizontal: 8, marginTop: 6 },
  gridAct: { flex: 1, height: 32, minHeight: 32, borderRadius: 8, backgroundColor: "#F2F3F7" },
  availableHint: { paddingHorizontal: 8, marginTop: 4, fontSize: 10, color: "#6B7289" },
  cover: { width: "100%", height: 180, borderRadius: 18, backgroundColor: "#E8EAF1" },
  coverThumb: { width: 88, height: 88, borderRadius: 14, backgroundColor: "#E8EAF1" },
  coverEmpty: { height: 180, alignItems: "center", justifyContent: "center" },
  coverEmptySmall: { width: 88, height: 88, alignItems: "center", justifyContent: "center" },
  liveCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(16,22,43,0.08)",
    paddingRight: 6,
  },
  liveCardHit: { flex: 1, minHeight: 0, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  liveCover: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#E8EAF1" },
  playDisc: {
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: NAVY,
  },
  trashBtn: { width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: 18, backgroundColor: "rgba(220,38,38,0.12)" },
  vitrineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  vitrineCell: { width: "31.5%", aspectRatio: 0.75, borderRadius: 10, overflow: "hidden", backgroundColor: "#111" },
  vitrineHit: { width: "100%", height: "100%", minHeight: 0, minWidth: 0, alignItems: "stretch" },
  vitrineImg: { width: "100%", height: "100%" },
  vitrineBadge: { position: "absolute", left: 6, bottom: 6, width: 24, height: 24, minWidth: 24, minHeight: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)" },
  vitrineTrash: {
    position: "absolute",
    right: 6,
    top: 6,
    zIndex: 2,
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  replayBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 54,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  replayTitle: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 14 },
  replayAction: {
    minHeight: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    flexDirection: "row",
    gap: 6,
  },
  replayActionTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  replayClose: {
    minHeight: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
});
