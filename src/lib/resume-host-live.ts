import { stopLiveReplay } from "./live-replay";
import { endLiveInDb, findOpenLives, markLiveActiveInDb, touchLiveHostInDb } from "./lives";
import { openLiveRowToOverlay, pickOpenLive, type BroadcastLiveOverlay } from "./open-live";

export type { BroadcastLiveOverlay, OpenLiveRow } from "./open-live";
export { openLiveRowToOverlay, pickOpenLive } from "./open-live";

export async function endAllOpenHostLives(sellerId: string): Promise<{
  ended: number;
  failed: number;
  remaining: import("./open-live").OpenLiveRow[];
}> {
  const rows = await findOpenLives(sellerId);
  const results = await Promise.all(rows.map((r) => endLiveInDb(r.id)));
  await Promise.all(rows.map((r) => stopLiveReplay(r.id).catch(() => undefined)));
  const failed = results.filter((r) => !r.ok).length;
  const remaining = failed ? await findOpenLives(sellerId) : [];
  return { ended: rows.length - failed, failed, remaining };
}

export async function resumeOpenHostLive(opts: {
  sellerId: string;
  displayName: string;
  preferredLiveId?: string | null;
}): Promise<{ ok: true; overlay: BroadcastLiveOverlay } | { ok: false; error: string }> {
  const rows = await findOpenLives(opts.sellerId);
  const target = pickOpenLive(rows, opts.preferredLiveId);
  if (!target) return { ok: false, error: "no-open-live" };

  const extras = rows.filter((r) => r.id !== target.id);
  if (extras.length > 0) {
    await Promise.all(extras.map((r) => stopLiveReplay(r.id).catch(() => undefined)));
    await Promise.all(extras.map((r) => endLiveInDb(r.id)));
  }

  await markLiveActiveInDb(target.id).catch(() => undefined);
  await touchLiveHostInDb(target.id).catch(() => undefined);

  return {
    ok: true,
    overlay: openLiveRowToOverlay(target, { id: opts.sellerId, displayName: opts.displayName }),
  };
}
