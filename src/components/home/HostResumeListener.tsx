import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/auth";
import { useNav } from "../../context/navigation";
import { subscribeResumeHostLive } from "../../lib/host-open-live";
import { resumeOpenHostLive } from "../../lib/resume-host-live";

/** Opens the host studio when the dangling banner or a resume_host_live push fires. */
export function HostResumeListener() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openOverlay, closeAllOverlays, isOverlayOpen } = useNav();
  const userRef = useRef(user);
  const hostingRef = useRef(false);
  userRef.current = user;
  hostingRef.current = isOverlayOpen("broadcast-live");

  useEffect(() => {
    return subscribeResumeHostLive((liveId) => {
      const u = userRef.current;
      if (!u?.id || hostingRef.current) return;
      void (async () => {
        const res = await resumeOpenHostLive({
          sellerId: u.id,
          displayName: u.displayName,
          preferredLiveId: liveId,
        });
        if (!res.ok) {
          Alert.alert(t("live.viewerConnectFailed"));
          return;
        }
        closeAllOverlays();
        openOverlay(res.overlay);
      })();
    });
  }, [closeAllOverlays, openOverlay, t]);

  return null;
}
