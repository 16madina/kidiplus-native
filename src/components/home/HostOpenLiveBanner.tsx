import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { Radio } from "lucide-react-native";
import { Press } from "../Press";
import { useAuth } from "../../context/auth";
import { useNav } from "../../context/navigation";
import {
  HOST_ABSENT_EXPIRE_MINUTES,
  HOST_ABSENT_WARN_MINUTES,
  minutesUntilHostExpire,
} from "../../lib/host-absent";
import {
  notifyHostLiveEnded,
  requestResumeHostLive,
  subscribeHostLiveEnded,
} from "../../lib/host-open-live";
import {
  expireAbandonedLivesInDb,
  findOpenLives,
  notifyAbsentHostLivesInDb,
} from "../../lib/lives";
import type { OpenLiveRow } from "../../lib/open-live";
import { endAllOpenHostLives } from "../../lib/resume-host-live";

export function HostOpenLiveBanner({
  variant = "home",
  style,
}: {
  variant?: "home" | "entry";
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isOverlayOpen } = useNav();
  const hosting = isOverlayOpen("broadcast-live");
  const [open, setOpen] = useState<OpenLiveRow | null>(null);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState<"resume" | "end" | null>(null);
  const lastHousekeepRef = useRef(0);

  const refresh = useCallback(
    async (opts?: { housekeep?: boolean }) => {
      if (!user?.id || hosting) {
        setOpen(null);
        setMinutesLeft(null);
        return;
      }
      const now = Date.now();
      const shouldHousekeep = opts?.housekeep === true || now - lastHousekeepRef.current > 120_000;
      if (shouldHousekeep) {
        lastHousekeepRef.current = now;
        await notifyAbsentHostLivesInDb(HOST_ABSENT_WARN_MINUTES, HOST_ABSENT_EXPIRE_MINUTES).catch(
          () => 0,
        );
        await expireAbandonedLivesInDb(user.id, HOST_ABSENT_EXPIRE_MINUTES).catch(() => 0);
      }
      const rows = await findOpenLives(user.id);
      const row = rows[0] ?? null;
      setOpen(row);
      if (row) {
        setMinutesLeft(minutesUntilHostExpire(row.host_last_seen_at, row.started_at));
      } else {
        setMinutesLeft(null);
      }
    },
    [user?.id, hosting],
  );

  useEffect(() => {
    if (hosting) {
      setOpen(null);
      return;
    }
    const run = () => {
      if (AppState.currentState !== "active") return;
      void refresh({ housekeep: true });
    };
    run();
    const iv = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh({ housekeep: true });
    });
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [refresh, hosting]);

  useEffect(() => subscribeHostLiveEnded((liveId) => {
    setOpen((prev) => {
      if (!prev) return null;
      if (liveId && prev.id !== liveId) return prev;
      return null;
    });
    setMinutesLeft(null);
  }), []);

  if (hosting || !open) return null;

  const title =
    variant === "entry"
      ? t("live.danglingTitle", { count: 1 })
      : t("live.homeOpenTitle");
  const body =
    variant === "entry"
      ? t("live.danglingReconnectBody", { title: open.title })
      : t("live.homeOpenBody", { title: open.title, minutes: minutesLeft ?? 5 });

  return (
    <View style={[styles.banner, style]}>
      <Radio size={16} color="#fff" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.row}>
          <Press
            disabled={busy !== null}
            onPress={() => {
              if (busy) return;
              setBusy("resume");
              requestResumeHostLive(open.id);
              setBusy(null);
            }}
            style={styles.resume}
          >
            {busy === "resume" ? (
              <ActivityIndicator size="small" color="#DC1E28" />
            ) : (
              <Text style={styles.resumeTxt}>{t("live.danglingReconnect")}</Text>
            )}
          </Press>
          <Press
            disabled={busy !== null}
            onPress={() => {
              if (!user?.id || busy) return;
              setBusy("end");
              void (async () => {
                const liveId = open.id;
                const res = await endAllOpenHostLives(user.id);
                setBusy(null);
                if (res.failed && res.ended === 0) {
                  Alert.alert(t("live.danglingEndFailed"));
                  return;
                }
                if (res.failed) {
                  Alert.alert(t("live.danglingEndPartial"));
                  setOpen(res.remaining[0] ?? null);
                  return;
                }
                notifyHostLiveEnded(liveId);
                setOpen(null);
              })();
            }}
            style={styles.end}
          >
            {busy === "end" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.endTxt}>{t("live.danglingEndAll")}</Text>
            )}
          </Press>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(220, 30, 40, 0.92)",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  title: { color: "#fff", fontSize: 12, fontWeight: "800" },
  body: { color: "rgba(255,255,255,0.92)", fontSize: 11, fontWeight: "600", lineHeight: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  resume: {
    minHeight: 32,
    height: 32,
    minWidth: 0,
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  resumeTxt: { color: "#DC1E28", fontSize: 12, fontWeight: "800" },
  end: {
    minHeight: 32,
    height: 32,
    minWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  endTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
