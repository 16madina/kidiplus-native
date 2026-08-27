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
import * as Notifications from "expo-notifications";
import { Press } from "../components/Press";
import { useAuth } from "./auth";
import { useNav } from "./navigation";
import {
  getPushPermissionStatus,
  markPrepromptShown,
  payloadFromNotificationResponse,
  registerForPush,
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
};

const PushContext = createContext<Ctx | null>(null);

export function PushProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openOverlay, setTab } = useNav();
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
        openOverlay({ kind: "activity" });
        return;
      }
      const kind = String(payload.kind ?? "notif");
      if (kind === "order") {
        openOverlay({ kind: "orders" });
        return;
      }
      if (kind === "chat") {
        openOverlay({ kind: "activity" });
        return;
      }
      if (kind === "live" || kind === "resume_host_live") {
        setTab("live");
        openOverlay({ kind: "activity" });
        return;
      }
      if (kind === "seller" || kind === "vitrine") {
        setTab("home");
        return;
      }
      openOverlay({ kind: "activity" });
    },
    [openOverlay, setTab],
  );

  const enable = useCallback(async () => {
    if (!user?.id) return false;
    const res = await registerForPush(user.id);
    setStatus(res.status);
    setToken(res.token);
    return res.status === "granted";
  }, [user?.id]);

  const requestWithPrePrompt = useCallback(
    async (reason: string) => {
      if (!user?.id) return false;
      const cur = await getPushPermissionStatus();
      if (cur === "granted") {
        const res = await registerForPush(user.id);
        setStatus(res.status);
        setToken(res.token);
        return true;
      }
      if (cur === "denied") {
        setStatus("denied");
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

  // Auto-register when already granted + signed in.
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

  // Clear token on sign-out.
  const prevUser = useRef<string | null>(null);
  useEffect(() => {
    const id = user?.id ?? null;
    if (prevUser.current && !id) {
      void unregisterDeviceToken(prevUser.current);
    }
    prevUser.current = id;
  }, [user?.id]);

  // Tap handlers (foreground / background / cold start).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const key = response.notification.request.identifier;
      if (handledRef.current === key) return;
      handledRef.current = key;
      routePush(payloadFromNotificationResponse(response));
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const key = response.notification.request.identifier;
      if (handledRef.current === key) return;
      handledRef.current = key;
      routePush(payloadFromNotificationResponse(response));
    });
    const received = Notifications.addNotificationReceivedListener(() => {
      // Foreground: banner already shown by handler; badge inbox can refresh later.
    });
    return () => {
      sub.remove();
      received.remove();
    };
  }, [routePush]);

  const value = useMemo<Ctx>(
    () => ({ status, token, refresh, requestWithPrePrompt, enable }),
    [status, token, refresh, requestWithPrePrompt, enable],
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
