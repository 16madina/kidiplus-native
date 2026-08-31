// Facebook OAuth + Page select + restream — same /api/facebook/* as the site.

import { kidiplusJson, openKidiplusOAuth } from "./kidiplus-api";

export type FacebookStatus = {
  connected: boolean;
  needsPageSelection: boolean;
  pageName?: string | null;
  pageId?: string | null;
  configIdSuffix?: string | null;
  hasLoginConfig?: boolean;
  grantedPermissions?: string[];
  missingChatPermissions?: string[];
  canReadComments?: boolean;
};

export type FacebookPageOption = { id: string; name: string };

export type FacebookRestreamStart = {
  egressId: string;
  liveVideoId: string;
  watchUrl: string;
  pageName?: string | null;
};

const FB_RETURN = "kidiplus://facebook-connected";

export async function fetchFacebookStatus(): Promise<FacebookStatus> {
  const res = await kidiplusJson<FacebookStatus>("/api/facebook/status");
  if (!res.ok) throw new Error(res.error);
  return {
    connected: !!res.data.connected,
    needsPageSelection: !!res.data.needsPageSelection,
    pageName: res.data.pageName,
    pageId: res.data.pageId,
    configIdSuffix: res.data.configIdSuffix ?? null,
    hasLoginConfig: !!res.data.hasLoginConfig,
    grantedPermissions: res.data.grantedPermissions ?? [],
    missingChatPermissions: res.data.missingChatPermissions ?? [],
    canReadComments: res.data.canReadComments !== false,
  };
}

export async function connectFacebook(returnPath = "/"): Promise<void> {
  const res = await kidiplusJson<{ url?: string }>("/api/facebook/oauth/start", {
    method: "POST",
    body: { native: true, returnPath },
  });
  if (!res.ok || !res.data.url) throw new Error(res.error || "OAuth start failed");
  const opened = await openKidiplusOAuth(res.data.url, FB_RETURN);
  if (opened === "cancel") throw new Error("cancelled");
}

export async function disconnectFacebook(): Promise<void> {
  const res = await kidiplusJson("/api/facebook/disconnect", { method: "POST", body: {} });
  if (!res.ok) throw new Error(res.error);
}

export async function fetchFacebookPages(): Promise<{
  pages: FacebookPageOption[];
  selectedPageId: string | null;
}> {
  const res = await kidiplusJson<{
    pages?: FacebookPageOption[];
    selectedPageId?: string | null;
  }>("/api/facebook/pages");
  if (!res.ok) throw new Error(res.error);
  return {
    pages: res.data.pages ?? [],
    selectedPageId: res.data.selectedPageId ?? null,
  };
}

export async function selectFacebookPage(pageId: string): Promise<{
  pageId: string;
  pageName: string;
}> {
  const res = await kidiplusJson<{ pageId?: string; pageName?: string }>("/api/facebook/pages", {
    method: "POST",
    body: { pageId },
  });
  if (!res.ok || !res.data.pageId || !res.data.pageName) {
    throw new Error(res.error || "Select page failed");
  }
  return { pageId: res.data.pageId, pageName: res.data.pageName };
}

export async function startFacebookRestream(liveId: string): Promise<FacebookRestreamStart> {
  const res = await kidiplusJson<FacebookRestreamStart>("/api/facebook/restream", {
    method: "POST",
    body: { action: "start", liveId },
  });
  if (!res.ok) throw new Error(res.error);
  if (!res.data.egressId || !res.data.liveVideoId || !res.data.watchUrl) {
    throw new Error("Restream response incomplete");
  }
  return {
    egressId: res.data.egressId,
    liveVideoId: res.data.liveVideoId,
    watchUrl: res.data.watchUrl,
    pageName: res.data.pageName,
  };
}

export async function stopFacebookRestream(liveId: string): Promise<void> {
  const res = await kidiplusJson("/api/facebook/restream", {
    method: "POST",
    body: { action: "stop", liveId },
  });
  if (!res.ok) throw new Error(res.error);
}

export function facebookReady(status: FacebookStatus | null | undefined): boolean {
  return !!status?.connected && !status.needsPageSelection && !!status.pageId;
}
