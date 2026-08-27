import { useEffect, useState } from "react";
import {
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
import { Footprints, Gavel, ImagePlus, Tag, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../Press";
import { pickImageFromLibrary, type PickedImage } from "../../lib/pick-image";
import { AUCTION_TIMER_PRESETS, newDraftId, type LiveDraftProduct, type LiveSaleKind } from "../../lib/broadcast-products";
import { currencySymbol, normalizeCurrency } from "../../lib/money";
import { GOLD, NAVY } from "../../theme";

export function AddProductSheet({
  open,
  onClose,
  onAdd,
  onPickFromShop,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (p: LiveDraftProduct) => void;
  onPickFromShop?: () => void;
  currency: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cur = normalizeCurrency(currency);
  const symbol = currencySymbol(cur);
  const defaults = cur === "XOF" ? { start: 500, price: 1000 } : { start: 1, price: 29 };

  const [mode, setMode] = useState<LiveSaleKind>("auction");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [slots, setSlots] = useState<Array<PickedImage | null>>([null, null, null]);
  const [startPrice, setStartPrice] = useState(String(defaults.start));
  const [timerSec, setTimerSec] = useState("45");
  const [price, setPrice] = useState(String(defaults.price));
  const [stock, setStock] = useState("1");
  const [bidIncrement, setBidIncrement] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("auction");
    setName("");
    setNameError(false);
    setSlots([null, null, null]);
    setStartPrice(String(defaults.start));
    setTimerSec("45");
    setPrice(String(defaults.price));
    setStock("1");
    setBidIncrement("");
    setDescription("");
  }, [open, defaults.start, defaults.price]);

  const pickSlot = async (i: number) => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setSlots((prev) => {
      const next = [...prev];
      next[i] = picked;
      return next;
    });
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(true);
      return;
    }
    const cover = slots[0];
    const inc = Number(bidIncrement.replace(",", "."));
    onAdd({
      id: newDraftId(),
      name: trimmed,
      image: cover?.preview,
      picked: cover,
      extraPicked: slots.slice(1),
      mode,
      startPrice: Math.max(1, Number(startPrice.replace(",", ".")) || defaults.start),
      price: Math.max(1, Number(price.replace(",", ".")) || defaults.price),
      timerSec: Math.max(10, Math.floor(Number(timerSec) || 45)),
      stock: Math.max(1, Math.floor(Number(stock) || 1)),
      bidIncrement: Number.isFinite(inc) && inc > 0 ? inc : null,
      description: description.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Press haptic="none" onPress={onClose} style={styles.dismiss} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text style={styles.title}>{t("broadcast.setup.productSheet.title")}</Text>
              <Press onPress={onClose} style={styles.close}>
                <X size={22} color={NAVY} />
              </Press>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
            >
              {onPickFromShop ? (
                <Press onPress={onPickFromShop} style={styles.shopPick}>
                  <Text style={styles.shopPickTxt}>{t("shop.pickFromShop")}</Text>
                </Press>
              ) : null}
              <View style={styles.photos}>
                {[0, 1, 2].map((i) => {
                  const src = slots[i]?.preview;
                  return (
                    <Press key={i} onPress={() => void pickSlot(i)} style={styles.photoBtn}>
                      <View style={[styles.photo, src ? styles.photoOn : null]}>
                        {src ? (
                          <Image source={{ uri: src }} style={styles.photoImg} contentFit="cover" />
                        ) : (
                          <>
                            <ImagePlus size={22} color="#8B90A0" />
                            <Text style={styles.photoLbl}>
                              {i === 0 ? t("productOptions.coverPhoto") : t("productOptions.addPhoto")}
                            </Text>
                          </>
                        )}
                      </View>
                    </Press>
                  );
                })}
              </View>
              <Text style={styles.hint}>{t("productOptions.photosHint")}</Text>

              <Text style={styles.label}>{t("broadcast.setup.productSheet.name")}</Text>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setNameError(false);
                }}
                placeholder={t("broadcast.setup.productSheet.namePlaceholder")}
                placeholderTextColor="#9AA0B4"
                style={[styles.field, nameError && styles.fieldErr]}
              />
              {nameError ? (
                <Text style={styles.err}>{t("broadcast.setup.productSheet.nameRequired")}</Text>
              ) : null}

              <Text style={styles.label}>{t("broadcast.setup.productSheet.type")}</Text>
              <View style={styles.modeRow}>
                <ModeBtn
                  active={mode === "auction"}
                  label={t("broadcast.setup.productSheet.auction")}
                  icon={<Gavel size={16} color={mode === "auction" ? "#fff" : NAVY} />}
                  onPress={() => setMode("auction")}
                />
                <ModeBtn
                  active={mode === "fixed"}
                  label={t("broadcast.setup.productSheet.fixedPrice")}
                  icon={<Tag size={16} color={mode === "fixed" ? "#fff" : NAVY} />}
                  onPress={() => setMode("fixed")}
                />
              </View>

              <View style={styles.two}>
                {mode === "auction" ? (
                  <NumField
                    label={`${t("broadcast.setup.productSheet.startingPrice")} (${symbol})`}
                    value={startPrice}
                    onChangeText={setStartPrice}
                  />
                ) : (
                  <NumField
                    label={`${t("broadcast.setup.productSheet.price")} (${symbol})`}
                    value={price}
                    onChangeText={setPrice}
                  />
                )}
                <NumField
                  label={t("shop.durationSec")}
                  value={timerSec}
                  onChangeText={(v) => setTimerSec(v.replace(/[^0-9]/g, ""))}
                  suffix="s"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.modeRow}>
                {AUCTION_TIMER_PRESETS.map((p) => {
                  const on = timerSec === String(p.sec);
                  return (
                    <Press key={p.sec} onPress={() => setTimerSec(String(p.sec))} style={styles.modeBtn}>
                      <View style={[styles.modeInner, on && styles.modeOn]}>
                        <Text style={[styles.modeTxt, on && styles.modeTxtOn]}>{p.label}</Text>
                      </View>
                    </Press>
                  );
                })}
              </View>

              <NumField label={t("productOptions.quantity")} value={stock} onChangeText={setStock} />

              {mode === "auction" ? (
                <>
                  <Text style={styles.label}>{t("productOptions.bidIncrement")}</Text>
                  <View style={styles.incRow}>
                    <Footprints size={16} color={GOLD} />
                    <TextInput
                      value={bidIncrement}
                      onChangeText={setBidIncrement}
                      placeholder="ex : 1"
                      placeholderTextColor="#9AA0B4"
                      keyboardType="decimal-pad"
                      style={styles.incInput}
                    />
                    <Text style={styles.incCur}>{symbol}</Text>
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>{t("productOptions.description")}</Text>
              <TextInput
                value={description}
                onChangeText={(v) => setDescription(v.slice(0, 250))}
                placeholder={t("productOptions.descriptionPlaceholder")}
                placeholderTextColor="#9AA0B4"
                multiline
                style={[styles.field, styles.area]}
              />
              <Text style={styles.counter}>{description.length}/250</Text>

              <Press onPress={save} style={styles.save}>
                <Text style={styles.saveTxt}>{t("broadcast.setup.productSheet.confirm")}</Text>
              </Press>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ModeBtn({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} style={styles.modeBtn}>
      <View style={[styles.modeInner, active && styles.modeOn]}>
        {icon}
        <Text style={[styles.modeTxt, active && styles.modeTxtOn]}>{label}</Text>
      </View>
    </Press>
  );
}

function NumField({
  label,
  value,
  onChangeText,
  icon,
  suffix,
  keyboardType = "decimal-pad",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  icon?: React.ReactNode;
  suffix?: string;
  keyboardType?: "decimal-pad" | "number-pad";
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.numWrap}>
        {icon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          style={styles.numInput}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  dismiss: { flex: 1, minHeight: 0, minWidth: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D8DCE8",
    marginTop: 8,
    marginBottom: 4,
  },
  head: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: NAVY },
  close: { width: 40, height: 40, minWidth: 40, minHeight: 40 },
  shopPick: {
    height: 48,
    borderRadius: 16,
    backgroundColor: NAVY,
    marginBottom: 4,
  },
  shopPickTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  photos: { flexDirection: "row", gap: 10 },
  photoBtn: { flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" },
  photo: {
    height: 112,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#D0D4E0",
    backgroundColor: "#F2F3F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoOn: { borderStyle: "solid", borderColor: "#E6E8EF" },
  photoImg: { width: "100%", height: "100%" },
  photoLbl: { marginTop: 4, fontSize: 11, fontWeight: "600", color: "#8B90A0" },
  hint: { fontSize: 12, color: "#6B7289", marginBottom: 8 },
  label: { marginTop: 8, fontSize: 14, fontWeight: "700", color: NAVY },
  field: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F2F3F7",
    paddingHorizontal: 14,
    fontSize: 15,
    color: NAVY,
    borderWidth: 1,
    borderColor: "#E6E8EF",
  },
  fieldErr: { borderColor: "#C62828" },
  err: { color: "#C62828", fontSize: 12, fontWeight: "700" },
  area: { height: 88, paddingTop: 12, textAlignVertical: "top" },
  counter: { alignSelf: "flex-end", fontSize: 11, color: "#9AA0B4" },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  modeBtn: { flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" },
  modeInner: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6E8EF",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modeOn: { backgroundColor: NAVY, borderColor: NAVY },
  modeTxt: { fontWeight: "800", color: NAVY, fontSize: 14 },
  modeTxtOn: { color: "#fff" },
  two: { flexDirection: "row", gap: 10 },
  numWrap: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F2F3F7",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E6E8EF",
  },
  numInput: { flex: 1, fontSize: 15, color: NAVY, height: 48 },
  suffix: { fontWeight: "800", color: "#8B90A0", fontSize: 13 },
  incRow: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F2F3F7",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E6E8EF",
  },
  incInput: { flex: 1, fontSize: 15, color: NAVY, height: 48 },
  incCur: { fontWeight: "800", color: NAVY, fontSize: 13 },
  save: {
    marginTop: 12,
    height: 52,
    borderRadius: 16,
    backgroundColor: NAVY,
  },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
