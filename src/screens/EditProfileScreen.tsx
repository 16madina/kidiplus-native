import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Camera } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { CountrySelect } from "../components/CountrySelect";
import { FormField } from "../components/FormField";
import { GoldButton } from "../components/Buttons";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { countryLabel } from "../lib/countries";
import { pickImageFromLibrary } from "../lib/pick-image";
import { supabase } from "../lib/supabase";
import { isHttpUrl } from "../lib/storage";
import { GOLD, initials } from "../theme";

export function EditProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, updateProfile } = useAuth();
  const { closeOverlay } = useNav();
  const { colors } = useAppTheme();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!user) return null;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const pickAvatar = async () => {
    if (uploading) return;
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    if (picked.blob.size > 5 * 1024 * 1024) {
      flash(t("shop.imageTooBig", { defaultValue: "Image trop lourde (max 5 Mo)." }));
      return;
    }
    setUploading(true);
    setPreview(picked.preview);
    try {
      const path = `${user.id}/avatar-${Date.now()}.${picked.ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, picked.blob, { upsert: true, contentType: picked.contentType });
      if (upErr) throw upErr;
      await updateProfile({ avatar_url: path });
      flash(t("profile.photoUpdated", { defaultValue: "Photo mise à jour" }));
    } catch (e) {
      setPreview(null);
      flash(e instanceof Error ? e.message : t("errors.generic", { defaultValue: "Erreur" }));
    } finally {
      setUploading(false);
    }
  };

  const validate = (): string | null => {
    if (firstName.trim().length < 2) return t("auth.validation.firstNameRequired");
    if (lastName.trim().length < 2) return t("auth.validation.lastNameRequired");
    if (!displayName.trim() || displayName.trim().length < 2) {
      return t("auth.validation.nameRequired");
    }
    if (!/^[a-z0-9_.]{2,30}$/.test(handle.trim())) {
      return t("profile.handleInvalid", {
        defaultValue: "Le handle doit contenir 2 à 30 caractères (minuscules, chiffres, _ ou .).",
      });
    }
    return null;
  };

  const save = async () => {
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        handle: handle.trim(),
        bio: bio.trim() || null,
        country: country || null,
      });
      flash(t("profile.updated", { defaultValue: "Profil mis à jour" }));
      setTimeout(closeOverlay, 700);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /duplicate|unique/i.test(msg)
          ? t("profile.handleTaken", { defaultValue: "Ce handle est déjà pris." })
          : msg || t("errors.generic", { defaultValue: "Erreur" }),
      );
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = preview || (isHttpUrl(user.avatarUrl) ? user.avatarUrl : null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("profile.editProfile")} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center" }}>
            <Press onPress={() => void pickAvatar()} style={styles.avatarPress}>
              <View style={[styles.avatarWrap, { borderColor: colors.border }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ fontSize: 28, fontWeight: "800", color: colors.mutedForeground }}>
                      {initials(displayName || "?")}
                    </Text>
                  </View>
                )}
                <View style={styles.camBadge}>
                  {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={14} color="#fff" />}
                </View>
              </View>
            </Press>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6 }}>
              {t("profile.editAvatar")}
            </Text>
          </View>

          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>
            {t("sellerPayments.legalNameHint")}
          </Text>
          <FormField
            required
            label={t("auth.signUp.firstName")}
            value={firstName}
            onChangeText={setFirstName}
            maxLength={40}
          />
          <FormField
            required
            label={t("auth.signUp.lastName")}
            value={lastName}
            onChangeText={setLastName}
            maxLength={40}
          />
          <FormField
            required
            label={t("auth.signUp.displayName")}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={40}
          />
          <FormField
            required
            label={t("auth.signUp.handle")}
            value={handle}
            onChangeText={(v) => setHandle(v.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          <FormField
            label={t("profile.bioLabel", { defaultValue: "Bio" })}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={200}
          />
          <CountrySelect
            label={t("auth.signUp.country")}
            value={country}
            includeOther
            onChange={(code) => setCountry(code ? countryLabel(code, i18n.language) : "🌍 Autre")}
          />
          {error ? (
            <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10 }}>
              <Text style={{ color: "#9B1C1C", fontSize: 13, fontWeight: "600" }}>{error}</Text>
            </View>
          ) : null}
          <GoldButton
            label={saving ? t("common.loading") : t("common.save")}
            onPress={() => void save()}
            disabled={saving || uploading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  avatarPress: { minHeight: 0, minWidth: 0 },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },
  camBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 26,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
