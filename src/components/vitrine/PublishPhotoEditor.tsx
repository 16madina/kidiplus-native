import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image as RNImage, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { cropCoverImage } from "../../lib/crop-image";
import { clampCoverTransform, cropRectFromCoverTransform } from "../../lib/publish-media";
import { GOLD, NAVY } from "../../theme";

type Box = { w: number; h: number };

export function PublishPhotoEditor({
  uri,
  imageWidth,
  imageHeight,
  onCancel,
  onConfirm,
}: {
  uri: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
}) {
  const { t } = useTranslation();
  const [box, setBox] = useState<Box>({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    imageWidth && imageHeight ? { w: imageWidth, h: imageHeight } : null,
  );
  const [busy, setBusy] = useState(false);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const imgW = useSharedValue(imageWidth || 1);
  const imgH = useSharedValue(imageHeight || 1);
  const viewW = useSharedValue(1);
  const viewH = useSharedValue(1);
  const live = useRef({ scale: 1, tx: 0, ty: 0 });

  useEffect(() => {
    if (imageWidth && imageHeight) {
      setNatural({ w: imageWidth, h: imageHeight });
      imgW.value = imageWidth;
      imgH.value = imageHeight;
      return;
    }
    RNImage.getSize(
      uri,
      (w, h) => {
        setNatural({ w, h });
        imgW.value = w;
        imgH.value = h;
      },
      () => setNatural({ w: 1080, h: 1920 }),
    );
  }, [uri, imageWidth, imageHeight, imgW, imgH]);

  const sync = (s: number, x: number, y: number) => {
    live.current = { scale: s, tx: x, ty: y };
  };

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      startScale.value = scale.value;
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const next = clampCoverTransform({
        imageW: imgW.value,
        imageH: imgH.value,
        viewW: viewW.value,
        viewH: viewH.value,
        scale: startScale.value * e.scale,
        translateX: startTx.value,
        translateY: startTy.value,
      });
      scale.value = next.scale;
      tx.value = next.translateX;
      ty.value = next.translateY;
    })
    .onEnd(() => {
      sync(scale.value, tx.value, ty.value);
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(4)
    .maxPointers(1)
    .onBegin(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const next = clampCoverTransform({
        imageW: imgW.value,
        imageH: imgH.value,
        viewW: viewW.value,
        viewH: viewH.value,
        scale: scale.value,
        translateX: startTx.value + e.translationX,
        translateY: startTy.value + e.translationY,
      });
      tx.value = next.translateX;
      ty.value = next.translateY;
    })
    .onEnd(() => {
      sync(scale.value, tx.value, ty.value);
    });

  const imageStyle = useAnimatedStyle(() => {
    const base =
      imgW.value > 0 && imgH.value > 0 && viewW.value > 0 && viewH.value > 0
        ? Math.max(viewW.value / imgW.value, viewH.value / imgH.value)
        : 1;
    const dw = imgW.value * base;
    const dh = imgH.value * base;
    return {
      width: dw,
      height: dh,
      left: (viewW.value - dw) / 2,
      top: (viewH.value - dh) / 2,
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    };
  });

  const confirm = async () => {
    if (!natural || box.w < 8 || busy) return;
    setBusy(true);
    try {
      const rect = cropRectFromCoverTransform({
        imageW: natural.w,
        imageH: natural.h,
        viewW: box.w,
        viewH: box.h,
        scale: live.current.scale,
        translateX: live.current.tx,
        translateY: live.current.ty,
      });
      onConfirm(await cropCoverImage(uri, rect));
    } catch {
      onConfirm(uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t("publish.edit.crop")}</Text>
      <View style={styles.stage}>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
          <View
            style={styles.frame}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width < 8 || height < 8) return;
              setBox({ w: width, h: height });
              viewW.value = width;
              viewH.value = height;
            }}
          >
            <Animated.View style={[styles.imgAbs, imageStyle]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
            </Animated.View>
            <View pointerEvents="none" style={styles.thirds}>
              <View style={[styles.thirdV, { left: "33.33%" }]} />
              <View style={[styles.thirdV, { left: "66.66%" }]} />
              <View style={[styles.thirdH, { top: "33.33%" }]} />
              <View style={[styles.thirdH, { top: "66.66%" }]} />
            </View>
          </View>
        </GestureDetector>
      </View>
      <Text style={styles.hint}>{t("publish.edit.pinchHint")}</Text>
      <View style={styles.row}>
        <Press onPress={onCancel} style={styles.ghost}>
          <Text style={styles.ghostTxt}>{t("common.back", { defaultValue: "Retour" })}</Text>
        </Press>
        <Press onPress={() => void confirm()} disabled={busy || !natural} style={styles.cta}>
          {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.ctaTxt}>{t("publish.edit.crop")}</Text>}
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingHorizontal: 12, paddingBottom: 8 },
  title: { color: "#fff", fontWeight: "900", fontSize: 16, textAlign: "center", marginVertical: 8 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: {
    width: "100%",
    maxHeight: "100%",
    aspectRatio: 9 / 16,
    overflow: "hidden",
    backgroundColor: "#111",
    borderRadius: 18,
  },
  imgAbs: { position: "absolute" },
  thirds: { ...StyleSheet.absoluteFill },
  thirdV: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.35)" },
  thirdH: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.35)" },
  hint: { color: "rgba(255,255,255,0.7)", textAlign: "center", fontWeight: "600", marginVertical: 10, fontSize: 13 },
  row: { flexDirection: "row", gap: 10 },
  ghost: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  ghostTxt: { color: "#fff", fontWeight: "800" },
  cta: { flex: 1, minHeight: 48, borderRadius: 999, backgroundColor: GOLD },
  ctaTxt: { color: NAVY, fontWeight: "900" },
});
