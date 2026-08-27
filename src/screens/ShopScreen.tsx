import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gavel, ImagePlus, Plus, Tag } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { AuthInput } from "../components/AuthInput";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { pickImageFromLibrary, type PickedImage } from "../lib/pick-image";
import {
  archiveShopProduct,
  createShopProduct,
  formatShopError,
  listMyShopProducts,
  reactivateShopProduct,
  updateShopProduct,
  uploadShopProductImage,
} from "../lib/shop";
import { GOLD } from "../theme";
import { type ShopItem } from "../mock/account";

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

export function ShopScreen() {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const { user, becomeSeller } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const reload = async () => {
    const id = user?.id;
    if (!id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const rows = await listMyShopProducts(id);
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  if (form) {
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("shop.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        <GoldButton label={t("shop.add")} onPress={openNew} icon={<Plus size={18} color="#151022" />} />
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24 }}>{t("shop.empty")}</Text>
        ) : (
          items.map((item) => (
            <Glass key={item.id} tone={dark ? "dark" : "light"} intensity={32} radius={18} elevated={false}>
              <Press onPress={() => openEdit(item)} style={{ alignItems: "stretch" }}>
                <View style={styles.card}>
                  {item.image ? <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" /> : <View style={styles.img} />}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontWeight: "800", color: colors.foreground }}>{item.name}</Text>
                    <Text style={{ color: GOLD, fontWeight: "800" }}>{item.price}</Text>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                      <View style={styles.pill}>
                        {item.kind === "auction" ? <Gavel size={11} color={GOLD} /> : <Tag size={11} color={GOLD} />}
                        <Text style={styles.pillText}>{item.kind === "auction" ? t("shop.auction") : t("shop.fixed")}</Text>
                      </View>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>
                          {t("shop.stock")} {item.stock}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Press
                    onPress={() => void toggleActive(item)}
                    style={styles.toggle}
                  >
                    <Text style={{ fontWeight: "700", fontSize: 12, color: item.active ? GOLD : colors.mutedForeground }}>
                      {item.active ? t("shop.active") : t("shop.archived")}
                    </Text>
                  </Press>
                </View>
              </Press>
            </Glass>
          ))
        )}
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  card: { flexDirection: "row", gap: 12, padding: 12, alignItems: "center" },
  img: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#E8EAF1" },
  cover: { width: "100%", height: 180, borderRadius: 18, backgroundColor: "#E8EAF1" },
  coverEmpty: { height: 180, alignItems: "center", justifyContent: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(232,185,59,0.14)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, fontWeight: "700", color: GOLD },
  toggle: { minHeight: 32, minWidth: 0, paddingHorizontal: 4 },
});
