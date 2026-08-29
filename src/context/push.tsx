import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../components/Press";
import { useAuth } from "./auth";
import { useNav } from "./navigation";
import { requestResumeHostLive } from "../lib/host-open-live";
import { fetchLiveById } from "../lib/lives";
import {
  getPushPermissionStatus,
  markPrepromptShown,
  pushNativeAvailable,
  registerForPush,
  subscribeNotificationResponses,
  unregisterDeviceToken,
  wasPrepromptShown,
  type PushOpenPayload,
  type PushStatus,
} from "../lib/push";
import { GOLD, NAVY } from "../theme";

type Ctx = {
  status: PushStatus;
  token: string | null;
  refresh: () => Promise<void>;
  /** Show pre-prompt then OS permission. Returns whether granted. */
  requestWithPrePrompt: (reason: string) => Promise<boolean>;
  /** Register without pre-prompt (Settings toggle). */
  enable: () => Promise<boolean>;
  /** Deep-link from a push / in-app notification payload. */
  openFromPush: (payload: PushOpenPayload | null) => void;
};

const PushContext = createContext<Ctx | null>(null);

export function PushProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openOverlay, openLive, setTab, setPendingVitrinePostId } = useNav();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<PushStatus>("unknown");
  const [token, setToken] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ reason: string; resolve: (b: boolean) => void } | null>(
    null,
  );
  const handledRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getPushPermissionStatus());
  }, []);

  const routePush = useCallback(
    (payload: PushOpenPayload | null) => {
      if (!payload) {
        openOverlay({ kind: "activity", tab: "notifs" });
        return;
      }
      const kind = String(payload.kind ?? "notif");
      if (kind === "order") {
        openOverlay({
          kind: "orders",
          orderId: typeof payload.order_id === "string" ? payload.order_id : undefined,
        });
        return;
      }
      if (kind === "chat") {
        openOverlay({
          kind: "activity",
          tab: "messages",
          threadId: typeof payload.thread_id === "string" ? payload.thread_id : undefined,
        });
        return;
      }
      if (kind === "live") {
        const liveId = typeof payload.live_id === "string" ? payload.live_id : null;
        if (liveId) {
          void fetchLiveById(liveId).then((stream) => {
            if (stream) openLive(stream);
            else setTab("live");
          });
          return;
        }
        setTab("live");
        return;
      }
      if (kind === "resume_host_live") {
        const liveId = typeof payload.live_id === "string" ? payload.live_id : null;
        requestResumeHostLive(liveId);
        return;
      }
      if (kind === "seller") {
        const sellerId = typeof payload.seller_id === "string" ? payload.seller_id : undefined;
        openOverlay({
          kind: "shop",
          sellerId,
          sellerName:
            typeof payload.seller_handle === "string" ? payload.seller_handle : undefined,
        });
        return;
      }
      if (kind === "vitrine") {
        setTab("vitrine");
        if (typeof payload.post_id === "string" && payload.post_id) {
          setPendingVitrinePostId(payload.post_id);
        }
        return;
      }
      openOverlay({ kind: "activity", tab: "notifs" });
    },
    [openOverlay, openLive, setTab, setPendingVitrinePostId],
  );

  const openFromPush = useCallback(
    (payload: PushOpenPayload | null) => {
      routePush(payload);
    },
    [routePush],
  );

  const enable = useCallback(async () => {
    if (!user?.id) return false;
    if (!pushNativeAvailable()) {
      setStatus("unavailable");
      return false;
    }
    const res = await registerForPush(user.id);
    setStatus(res.status);
    setToken(res.token);
    return res.status === "granted";
  }, [user?.id]);

  const requestWithPrePrompt = useCallback(
    async (reason: string) => {
      if (!user?.id) return false;
      if (!pushNativeAvailable()) {
        setStatus("unavailable");
        return false;
      }
      const cur = await getPushPermissionStatus();
      if (cur === "granted") {
        const res = await registerForPush(user.id);
        setStatus(res.status);
        setToken(res.token);
        return true;
      }
      if (cur === "denied" || cur === "unavailable") {
        setStatus(cur);
        return false;
      }
      const shown = await wasPrepromptShown();
      if (!shown) {
        await markPrepromptShown();
        return await new Promise<boolean>((resolve) => {
          setPrompt({ reason, resolve });
        });
      }
      return enable();
    },
    [user?.id, enable],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) {
      setToken(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const cur = await getPushPermissionStatus();
      if (cancelled) return;
      setStatus(cur);
      if (cur === "granted") {
        const res = await registerForPush(user.id);
        if (!cancelled) {
          setStatus(res.status);
          setToken(res.token);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const prevUser = useRef<string | null>(null);
  useEffect(() => {
    const id = user?.id ?? null;
    if (prevUser.current && !id) {
      void unregisterDeviceToken(prevUser.current);
    }
    prevUser.current = id;
  }, [user?.id]);

  useEffect(() => {
    return subscribeNotificationResponses((payload, id) => {
      if (handledRef.current === id) return;
      handledRef.current = id;
      routePush(payload);
    });
  }, [routePush]);

  const value = useMemo<Ctx>(
    () => ({ status, token, refresh, requestWithPrePrompt, enable, openFromPush }),
    [status, token, refresh, requestWithPrePrompt, enable, openFromPush],
  );

  const finishPrompt = async (accept: boolean) => {
    const p = prompt;
    setPrompt(null);
    if (!p) return;
    if (!accept) {
      p.resolve(false);
      return;
    }
    const ok = await enable();
    p.resolve(ok);
  };

  return (
    <PushContext.Provider value={value}>
      {children}
      <Modal visible={!!prompt} transparent animationType="fade" onRequestClose={() => void finishPrompt(false)}>
        <View style={styles.dim}>
          <View style={[styles.card, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <View style={styles.iconWrap}>
              <Bell size={28} color={NAVY} />
            </View>
            <Text style={styles.title}>
              {t("push.prepromptTitle", { defaultValue: "Ne rate aucun live" })}
            </Text>
            <Text style={styles.body}>
              {prompt?.reason ||
                t("push.prepromptBody", {
                  defaultValue:
                    "Active les notifications pour les rappels de live, enchères, commandes et messages.",
                })}
            </Text>
            <Press style={styles.cta} onPress={() => void finishPrompt(true)}>
              <Text style={styles.ctaTxt}>
                {t("push.enable", { defaultValue: "Activer les notifications" })}
              </Text>
            </Press>
            <Press style={styles.later} onPress={() => void finishPrompt(false)}>
              <Text style={styles.laterTxt}>{t("common.later", { defaultValue: "Plus tard" })}</Text>
            </Press>
          </View>
        </View>
      </Modal>
    </PushContext.Provider>
  );
}

export function usePush(): Ctx {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error("usePush must be used within PushProvider");
  return ctx;
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    gap: 10,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(232,185,59,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "900", color: NAVY },
  body: { fontSize: 14, lineHeight: 20, color: "rgba(16,22,43,0.7)", fontWeight: "600" },
  cta: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTxt: { color: NAVY, fontWeight: "900", fontSize: 15 },
  later: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  laterTxt: { color: "rgba(16,22,43,0.55)", fontWeight: "700" },
});
