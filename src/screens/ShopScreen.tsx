import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Archive, Clapperboard, ImagePlus, Pencil, Plus, Radio, ShoppingBag, Tag, Users, Video } from "lucide-react-native";
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
import { countSellerLives, fetchSellerLives, isReplayPlayable, type SellerLiveEntry } from "../lib/lives";
import { countVitrinePostsByUser, fetchVitrinePostsByUser, looksLikeVideo, type VitrineFeedPost } from "../lib/vitrine";
import { fetchSellerPublic, uploadBanner, type SellerPublic } from "../lib/seller";
import { GOLD, NAVY, initials } from "../theme";
import { isHttpUrl } from "../lib/storage";
import { type ShopItem } from "../mock/account";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

type FormState = {
  item: ShopItem | null;
  name: string;
  price: string;
  stock: string;
  description: string;
  preview: string;
  path: string | null;
  picked: PickedImage | null;
};

function emptyForm(): FormState {
  return {
    item: null,
    name: "",
    price: "",
    stock: "1",
    description: "",
    preview: "",
    path: null,
    picked: null,
  };
}

export function ShopScreen({
  sellerId,
  sellerName,
}: {
  sellerId?: string;
  sellerName?: string;
} = {}) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const { user, becomeSeller } = useAuth();
  const { openOverlay } = useNav();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const own = !sellerId || sellerId === user?.id;
  const [shopTab, setShopTab] = useState<"boutique" | "lives" | "replays" | "vitrine">("boutique");
  const [seller, setSeller] = useState<SellerPublic | null>(null);
  const [lives, setLives] = useState<SellerLiveEntry[]>([]);
  const [vitrinePosts, setVitrinePosts] = useState<VitrineFeedPost[]>([]);
  const [livesCount, setLivesCount] = useState(0);
  const [vitrineCount, setVitrineCount] = useState(0);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);

  const reload = async () => {
    const id = own ? user?.id : sellerId;
    if (!id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const rows = own ? await listMyShopProducts(id) : await listSellerActiveShopProducts(id);
    setItems(rows);
    const [pub, liveRows, vCount, liveCount, vPosts] = await Promise.all([
      fetchSellerPublic(id),
      fetchSellerLives(id),
      countVitrinePostsByUser(id),
      countSellerLives(id),
      fetchVitrinePostsByUser(id),
    ]);
    setSeller(pub);
    setLives(liveRows);
    setVitrineCount(vCount);
    setLivesCount(liveCount);
    setVitrinePosts(vPosts);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sellerId, own]);

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
    setForm({
      item,
      name: item.name,
      price: item.priceValue != null ? String(item.priceValue) : "",
      stock: String(item.stock),
      description: item.description ?? "",
      preview: item.image,
      path: item.imagePath ?? null,
      picked: null,
    });
  };

  const pickPhoto = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) {
      if (Platform.OS !== "web") flash(t("shop.pickPhotoWeb"));
      return;
    }
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
    setForm((prev) => (prev ? { ...prev, picked, preview: picked.preview, path: null } : prev));
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
      let imagePaths = form.path ? [form.path] : form.item?.imagePath ? [form.item.imagePath] : [];
      if (form.picked) {
        const path = await uploadShopProductImage(user.id, form.picked);
        imagePaths = [path];
      }
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
    if (!picked) {
      if (Platform.OS !== "web") flash(t("shop.pickPhotoWeb"));
      return;
    }
    try {
      const url = await uploadBanner(user.id, picked);
      setSeller((prev) => (prev ? { ...prev, bannerUrl: url } : prev));
      flash(t("shop.bannerUpdated", { defaultValue: "Bannière mise à jour" }));
    } catch (err) {
      flash(formatShopError(err));
    }
  };

  const featured = useMemo(() => items.filter((p) => p.active).slice(0, 8), [items]);
  const replays = useMemo(() => lives.filter(isReplayPlayable), [lives]);
  const displayName = seller?.displayName || sellerName || user?.displayName || t("shop.title");
  const handle = seller?.handle || user?.handle || "";
  const avatar = seller?.avatarUrl || (own ? user?.avatarUrl : null);
  const banner = seller?.bannerUrl || (own ? user?.bannerUrl : null);
  const bio = seller?.bio || user?.bio;
  const followers = seller?.followers ?? user?.followers ?? 0;

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
            <Press onPress={() => void pickPhoto()} style={{ alignItems: "stretch" }}>
              <Glass tone={dark ? "dark" : "light"} intensity={32} radius={18} elevated={false}>
                {form.preview ? (
                  <Image source={{ uri: form.preview }} style={styles.cover} contentFit="cover" />
                ) : (
                  <View style={styles.coverEmpty}>
                    <ImagePlus size={28} color={GOLD} />
                    <Text style={{ color: colors.mutedForeground, fontWeight: "700", marginTop: 8 }}>
                      {t("shop.pickPhoto")}
                    </Text>
                  </View>
                )}
              </Glass>
            </Press>
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
      <OverlayHeader title={own ? t("shop.title") : `${displayName} Boutique`} />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
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
              <Text style={styles.bannerChipTxt}>{banner ? "Bannière" : "Ajouter une bannière"}</Text>
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
            </View>
            <Text style={styles.heroTitle}>{displayName} Boutique</Text>
            {handle ? <Text style={styles.heroHandle}>@{handle}</Text> : null}
            <Text style={styles.heroBio} numberOfLines={3}>
              {bio || "L'élégance, la qualité, pour vos petits trésors. 🤎"}
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat icon={<ShoppingBag size={16} color="#C8A24B" />} n={items.length} label="Produits" onPress={() => setShopTab("boutique")} />
          <Stat icon={<Users size={16} color="#C8A24B" />} n={followers} label="Abonnés" />
          <Stat
            icon={<Video size={16} color="#C8A24B" />}
            n={livesCount}
            label="Lives réalisés"
            onPress={() => own && setShopTab("lives")}
          />
          <Stat
            icon={<Clapperboard size={16} color="#C8A24B" />}
            n={vitrineCount}
            label="Vitrine"
            onPress={() => setShopTab("vitrine")}
          />
        </View>

        {own ? (
          <View style={styles.actions}>
            <Press onPress={openNew} style={styles.addBtn}>
              <Plus size={16} color="#fff" />
              <Text style={styles.addBtnTxt}>Ajouter</Text>
            </Press>
            <Press onPress={() => openOverlay({ kind: "broadcast-setup", mode: "now" })} style={styles.liveBtn}>
              <Radio size={15} color="#fff" />
              <Text style={styles.addBtnTxt}>Lancer un live</Text>
            </Press>
          </View>
        ) : null}

        <View style={styles.tabStrip}>
          {(
            [
              ["boutique", "Boutique"],
              ["vitrine", "Vitrine"],
              ["lives", "Lives effectués"],
              ["replays", "Replays"],
            ] as const
          )
            .filter(([k]) => own || k === "boutique" || k === "vitrine")
            .map(([k, label]) => (
              <Press key={k} onPress={() => setShopTab(k)} style={styles.tabBtn}>
                <Text style={[styles.tabTxt, shopTab === k && styles.tabTxtOn]}>{label}</Text>
                {shopTab === k ? <View style={styles.tabUnderline} /> : null}
              </Press>
            ))}
        </View>

        {loading ? <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} /> : null}

        {!loading && shopTab === "boutique" ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {featured.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Produits en vedette</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                  {featured.map((item) => (
                    <Press key={`f-${item.id}`} onPress={() => own && openEdit(item)} style={styles.featCard}>
                      {item.image ? <Image source={{ uri: item.image }} style={styles.featImg} contentFit="cover" /> : <View style={styles.featImg} />}
                      <Text numberOfLines={1} style={styles.featName}>{item.name}</Text>
                      <Text style={styles.featPrice}>{item.price}</Text>
                    </Press>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>Toutes les catégories</Text>
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
        ) : null}

        {!loading && shopTab === "lives" ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {lives.length === 0 ? (
              <Text style={{ color: "#6B7289", textAlign: "center", marginTop: 16 }}>{t("admin.lives.empty", { defaultValue: "Aucun live." })}</Text>
            ) : (
              lives.map((l) => (
                <Glass key={l.id} tone="light" intensity={32} radius={16} elevated={false}>
                  <View style={styles.liveRow}>
                    {l.cover_url ? <Image source={{ uri: l.cover_url }} style={styles.liveCover} contentFit="cover" /> : <View style={styles.liveCover} />}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "800", color: NAVY }}>{l.title}</Text>
                      <Text style={{ color: "#6B7289", marginTop: 2, fontSize: 12 }}>
                        {l.status === "live" ? "EN DIRECT" : l.status === "scheduled" ? "Programmé" : "Terminé"}
                        {l.viewer_count ? ` · ${l.viewer_count} viewers` : ""}
                      </Text>
                    </View>
                    {l.status === "live" ? <Radio size={16} color="#E5393F" /> : <Clapperboard size={16} color={GOLD} />}
                  </View>
                </Glass>
              ))
            )}
          </View>
        ) : null}

        {!loading && shopTab === "replays" ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {replays.length === 0 ? (
              <Text style={{ color: "#6B7289", textAlign: "center", marginTop: 16 }}>
                {t("shop.noReplays", { defaultValue: "Aucun replay pour le moment." })}
              </Text>
            ) : (
              replays.map((l) => (
                <Press key={l.id} onPress={() => l.replay_url && setReplayUrl(l.replay_url)} style={{ alignItems: "stretch" }}>
                  <Glass tone="light" intensity={32} radius={16} elevated={false}>
                    <View style={styles.liveRow}>
                      {l.cover_url ? <Image source={{ uri: l.cover_url }} style={styles.liveCover} contentFit="cover" /> : <View style={styles.liveCover} />}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "800", color: NAVY }}>{l.title}</Text>
                        <Text style={{ color: GOLD, marginTop: 2, fontWeight: "700", fontSize: 12 }}>Replay</Text>
                      </View>
                      <Video size={16} color={GOLD} />
                    </View>
                  </Glass>
                </Press>
              ))
            )}
          </View>
        ) : null}

        {!loading && shopTab === "vitrine" ? (
          <View style={styles.vitrineGrid}>
            {vitrinePosts.length === 0 ? (
              <Text style={{ color: "#6B7289", textAlign: "center", width: "100%", marginTop: 16 }}>
                {t("vitrine.emptyForYou")}
              </Text>
            ) : (
              vitrinePosts.map((p) => {
                const thumb = p.posterUrl || p.mediaUrls[0];
                return (
                  <View key={p.id} style={styles.vitrineCell}>
                    {thumb ? <Image source={{ uri: thumb }} style={styles.vitrineImg} contentFit="cover" /> : <View style={styles.vitrineImg} />}
                    {looksLikeVideo(p.mediaUrls[0] || "", p.mediaType) ? (
                      <View style={styles.vitrineBadge}>
                        <Video size={12} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>
      <ReplayModal url={replayUrl} onClose={() => setReplayUrl(null)} />
      <MockBanner text={toast} />
    </View>
  );
}

function Stat({
  n,
  label,
  onPress,
  icon,
}: {
  n: number;
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
}) {
  const value = n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "")}k` : String(n);
  return (
    <Press onPress={onPress} style={styles.stat}>
      {icon}
      <Text style={styles.statL}>{label}</Text>
      <Text style={styles.statN}>{value}</Text>
    </Press>
  );
}

function ReplayModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <ReplayPlayer uri={url} />
        <Press onPress={onClose} style={{ position: "absolute", top: 48, left: 16, minHeight: 40 }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>Fermer</Text>
        </Press>
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
  statL: { fontSize: 10, color: "#6B7289", fontWeight: "700" },
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
  addBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
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
  sectionTitle: { fontWeight: "800", color: NAVY, fontSize: 17, marginBottom: 8 },
  featCard: { width: 148, minHeight: 0, minWidth: 0, alignItems: "stretch" },
  featImg: { width: 148, height: 148, borderRadius: 16, backgroundColor: "#E8EAF1" },
  featName: { marginTop: 6, fontWeight: "800", color: NAVY, fontSize: 12 },
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
  coverEmpty: { height: 180, alignItems: "center", justifyContent: "center" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  liveCover: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#E8EAF1" },
  vitrineGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 6 },
  vitrineCell: { width: "31.5%", aspectRatio: 0.75, borderRadius: 10, overflow: "hidden", backgroundColor: "#111" },
  vitrineImg: { width: "100%", height: "100%" },
  vitrineBadge: { position: "absolute", right: 6, top: 6 },
});
