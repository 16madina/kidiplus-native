import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Aperture, ImagePlus, UserRound, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
import { GOLD, NAVY } from "../../theme";

export function EffectsBar() {
  const { t } = useTranslation();
  const effects = useLiveEffects();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("broadcast.effects.title", "Fond & poster")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <EffectTile
          label={t("broadcast.effects.blur", "Flou du fond")}
          active={effects.backgroundMode === "blur"}
          icon={<Aperture size={20} color="#fff" />}
          onPress={() => effects.setBackgroundBlur(effects.backgroundMode !== "blur")}
        />
        <EffectTile
          label={t("broadcast.effects.greenScreen", "Écran vert")}
          active={effects.backgroundMode === "image"}
          thumb={effects.backgroundMode === "image" ? effects.backgroundUrl : null}
          icon={<ImagePlus size={20} color="#fff" />}
          onPress={() => {
            if (effects.backgroundMode === "image") effects.clearBackground();
            else void effects.setBackgroundFromPicker();
          }}
        />
        <EffectTile
          label={t("broadcast.effects.posterFace", "Ajouter image")}
          active={!!effects.posterUrl && effects.posterMode === "cover"}
          thumb={effects.posterMode === "cover" ? effects.posterUrl : null}
          icon={<UserRound size={20} color="#fff" />}
          onPress={() => {
            if (effects.posterUrl && effects.posterMode === "cover") {
              effects.clearPoster();
              return;
            }
            void effects.setPosterFromPicker();
          }}
        />
      </ScrollView>
    </View>
  );
}

function EffectTile({
  label,
  active,
  thumb,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  thumb?: string | null;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} style={styles.tile}>
      <View style={[styles.swatch, active && styles.swatchOn]}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.swatchImg} contentFit="cover" />
        ) : (
          icon
        )}
        {active ? (
          <View style={styles.check}>
            <Check size={10} color={NAVY} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.label, active && { color: GOLD }]}>
        {label}
      </Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  title: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    paddingLeft: 2,
  },
  row: { gap: 10, paddingRight: 12 },
  tile: { width: 72, minHeight: 0, minWidth: 0, alignItems: "center", gap: 5 },
  swatch: {
    width: 62,
    height: 62,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  swatchOn: { borderColor: GOLD },
  swatchImg: { width: "100%", height: "100%" },
  check: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 72,
  },
});
