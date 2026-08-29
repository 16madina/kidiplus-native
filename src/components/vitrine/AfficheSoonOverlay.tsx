import { type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { CalendarClock, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "../Press";
import { formatAfficheWhenParts } from "../../lib/affiche-reminders-logic";
import { splitAfficheEventAt, type AfficheLayout, type AfficheSoonField } from "../../lib/vitrine-affiche";
import { GOLD, initials, NAVY } from "../../theme";
import { isHttpUrl } from "../../lib/storage";

export function AfficheSoonOverlay({
  layout,
  editable = false,
  focused = null,
  onFocus,
  onChange,
  avatarUrl,
  fallbackSeller,
  fallbackShop,
  footer,
}: {
  layout: AfficheLayout;
  editable?: boolean;
  focused?: AfficheSoonField | null;
  onFocus?: (field: AfficheSoonField | null) => void;
  onChange?: (patch: Partial<Pick<AfficheLayout, "badge" | "title" | "sellerName" | "shopName" | "eventAt">>) => void;
  avatarUrl?: string | null;
  fallbackSeller?: string;
  fallbackShop?: string;
  footer?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? "en-GB" : "fr-FR";
  const when = splitAfficheEventAt(layout.eventAt);
  const parts = formatAfficheWhenParts(layout.eventAt, locale);
  const badge = layout.badge.trim() || t("vitrine.tabs.soon");
  const seller = layout.sellerName.trim() || fallbackSeller || "";
  const shop = layout.shopName.trim() || fallbackShop || "";
  const title = layout.title.trim();

  const setWhen = (date: string, time: string) => {
    const raw = `${date.trim()}T${time.trim() || "18:00"}`;
    const ms = new Date(raw).getTime();
    onChange?.({ eventAt: Number.isFinite(ms) ? new Date(ms).toISOString() : layout.eventAt });
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent"]} style={styles.fadeTop} pointerEvents="none" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={styles.fadeBottom} pointerEvents="none" />

      <View style={styles.topBar} pointerEvents={editable ? "auto" : "none"}>
        <Field
          editable={editable}
          focused={focused === "badge"}
          onPress={() => onFocus?.("badge")}
          style={styles.badge}
        >
          {editable && focused === "badge" ? (
            <TextInput
              autoFocus
              value={layout.badge}
              onChangeText={(badge) => onChange?.({ badge })}
              placeholder={t("vitrine.tabs.soon")}
              placeholderTextColor={NAVY}
              style={styles.badgeInput}
            />
          ) : (
            <View style={styles.badgeInner}>
              <CalendarClock size={13} color={NAVY} />
              <Text style={styles.badgeTxt}>{badge.toUpperCase()}</Text>
            </View>
          )}
        </Field>
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.sellerRow}>
          {isHttpUrl(avatarUrl) ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.ini}>{initials(seller || "K")}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Field editable={editable} focused={focused === "seller"} onPress={() => onFocus?.("seller")}>
              {editable && focused === "seller" ? (
                <TextInput
                  autoFocus
                  value={layout.sellerName}
                  onChangeText={(sellerName) => onChange?.({ sellerName })}
                  placeholder={t("publish.affiche.namePlaceholder")}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={styles.nameInput}
                />
              ) : (
                <Text style={styles.seller} numberOfLines={1}>
                  {seller || t("publish.affiche.namePlaceholder")}
                </Text>
              )}
            </Field>
            <Field editable={editable} focused={focused === "shop"} onPress={() => onFocus?.("shop")}>
              {editable && focused === "shop" ? (
                <TextInput
                  autoFocus
                  value={layout.shopName}
                  onChangeText={(shopName) => onChange?.({ shopName })}
                  placeholder={t("publish.affiche.shopPlaceholder")}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.shopInput}
                />
              ) : (
                <View style={styles.shopRow}>
                  <Store size={12} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.shop} numberOfLines={1}>
                    {shop || t("publish.affiche.shopPlaceholder")}
                  </Text>
                </View>
              )}
            </Field>
          </View>
        </View>

        <Field editable={editable} focused={focused === "title"} onPress={() => onFocus?.("title")}>
          {editable && focused === "title" ? (
            <TextInput
              autoFocus
              multiline
              value={layout.title}
              onChangeText={(title) => onChange?.({ title })}
              placeholder={t("publish.affiche.titlePlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.titleInput}
            />
          ) : (
            <Text style={[styles.title, !title && styles.placeholder]} numberOfLines={2}>
              {title || t("publish.affiche.titlePlaceholder")}
            </Text>
          )}
        </Field>

        <View style={styles.whenCard}>
          <CalendarClock size={18} color={GOLD} />
          <View style={{ flex: 1, gap: 4 }}>
            <Field editable={editable} focused={focused === "date"} onPress={() => onFocus?.("date")}>
              {editable && focused === "date" ? (
                <TextInput
                  autoFocus
                  value={when.date}
                  onChangeText={(date) => setWhen(date, when.time)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="numbers-and-punctuation"
                  style={styles.whenInput}
                />
              ) : (
                <Text style={styles.whenDate}>{parts?.date ?? when.date}</Text>
              )}
            </Field>
            <Field editable={editable} focused={focused === "time"} onPress={() => onFocus?.("time")}>
              {editable && focused === "time" ? (
                <TextInput
                  autoFocus
                  value={when.time}
                  onChangeText={(time) => setWhen(when.date, time)}
                  placeholder="HH:MM"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="numbers-and-punctuation"
                  style={styles.whenTimeInput}
                />
              ) : (
                <Text style={styles.whenTime}>{parts?.time ?? when.time}</Text>
              )}
            </Field>
          </View>
        </View>

        {footer}
      </View>
    </View>
  );
}

function Field({
  editable,
  focused,
  onPress,
  style,
  children,
}: {
  editable: boolean;
  focused: boolean;
  onPress: () => void;
  style?: object;
  children: ReactNode;
}) {
  if (!editable) return <View style={style}>{children}</View>;
  return (
    <Press onPress={onPress} style={[style, focused && styles.focused]}>
      {children}
    </Press>
  );
}

const styles = StyleSheet.create({
  fadeTop: { position: "absolute", left: 0, right: 0, top: 0, height: "22%" },
  fadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: "62%" },
  topBar: { position: "absolute", left: 12, right: 12, top: 12, zIndex: 6 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: "center",
  },
  badgeInner: { flexDirection: "row", alignItems: "center", gap: 5 },
  badgeTxt: { color: NAVY, fontWeight: "900", fontSize: 11.5, letterSpacing: 0.4 },
  badgeInput: { color: NAVY, fontWeight: "900", fontSize: 13, minWidth: 90, padding: 0 },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
    zIndex: 6,
    gap: 10,
  },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: GOLD },
  avatarFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  ini: { color: "#fff", fontWeight: "800" },
  seller: { color: "#fff", fontSize: 17, fontWeight: "900" },
  nameInput: { color: "#fff", fontSize: 17, fontWeight: "900", padding: 0, minHeight: 28 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  shop: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700" },
  shopInput: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700", padding: 0, minHeight: 24 },
  title: { color: "rgba(255,255,255,0.95)", fontSize: 15, fontWeight: "700" },
  titleInput: { color: "#fff", fontSize: 15, fontWeight: "700", padding: 0, minHeight: 36 },
  placeholder: { color: "rgba(255,255,255,0.45)" },
  whenCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  whenDate: { color: "#fff", fontSize: 13.5, fontWeight: "800", textTransform: "capitalize" },
  whenTime: { color: GOLD, fontSize: 15, fontWeight: "900", marginTop: 1 },
  whenInput: { color: "#fff", fontWeight: "800", fontSize: 14, padding: 0, minHeight: 26 },
  whenTimeInput: { color: GOLD, fontWeight: "900", fontSize: 15, padding: 0, minHeight: 26 },
  focused: {
    borderWidth: 1.5,
    borderColor: GOLD,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});
