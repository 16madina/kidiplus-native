import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { AfficheEditor } from "./AfficheEditor";
import { PublishCameraPane } from "./PublishCameraPane";
import {
  PUBLISH_HUB_LABEL_KEY,
  PUBLISH_HUB_MODES,
  type PublishHubMode,
} from "../../lib/publish-hub";
import { GOLD } from "../../theme";

export function PublishHub({
  open,
  initialMode = "video",
  onClose,
  onPublished,
}: {
  open: boolean;
  initialMode?: PublishHubMode;
  onClose: () => void;
  onPublished: (mode: PublishHubMode) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<PublishHubMode>>(null);
  const [mode, setMode] = useState<PublishHubMode>(initialMode);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!open) {
      setLocked(false);
      return;
    }
    setMode(initialMode);
    const idx = PUBLISH_HUB_MODES.indexOf(initialMode);
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index: Math.max(0, idx), animated: false });
      } catch {
        /* ignore */
      }
    });
  }, [open, initialMode]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable)?.item as PublishHubMode | undefined;
    if (first) setMode(first);
  }).current;

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.head}>
          <Text style={styles.title}>{t("publish.title")}</Text>
          <Press onPress={onClose} style={styles.close}>
            <X size={20} color="#fff" />
          </Press>
        </View>

        <FlatList
          ref={listRef}
          data={[...PUBLISH_HUB_MODES]}
          keyExtractor={(m) => m}
          horizontal
          pagingEnabled
          scrollEnabled={!locked}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onViewableItemsChanged={onViewable}
          extraData={mode}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item }) => (
            <View style={{ width, height: height - insets.top - insets.bottom - 108 }}>
              {item === "affiche" ? (
                <AfficheEditor
                  onPublished={() => {
                    onPublished("affiche");
                    onClose();
                  }}
                />
              ) : item === mode ? (
                <PublishCameraPane
                  mode={item}
                  active={open && mode === item}
                  onLockChange={setLocked}
                  onPublished={() => {
                    onPublished(item);
                    onClose();
                  }}
                />
              ) : (
                <View style={{ flex: 1, backgroundColor: "#05060a" }} />
              )}
            </View>
          )}
        />

        <View style={[styles.strip, { paddingBottom: insets.bottom + 8 }]}>
          {PUBLISH_HUB_MODES.map((m) => (
            <Press
              key={m}
              onPress={() => {
                if (locked) return;
                setMode(m);
                const idx = PUBLISH_HUB_MODES.indexOf(m);
                listRef.current?.scrollToIndex({ index: idx, animated: true });
              }}
              style={styles.tab}
            >
              <Text style={[styles.tabTxt, mode === m && styles.tabOn, locked && mode !== m && { opacity: 0.35 }]}>
                {t(PUBLISH_HUB_LABEL_KEY[m])}
              </Text>
              {mode === m ? <View style={styles.dot} /> : null}
            </Press>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060a" },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 48,
  },
  title: { color: "#fff", fontWeight: "900", fontSize: 18 },
  close: { width: 40, height: 40, minWidth: 40, minHeight: 40 },
  strip: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  tab: { alignItems: "center", minWidth: 70, paddingVertical: 10 },
  tabTxt: { color: "rgba(255,255,255,0.45)", fontWeight: "800", letterSpacing: 0.6 },
  tabOn: { color: GOLD },
  dot: { marginTop: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
});
