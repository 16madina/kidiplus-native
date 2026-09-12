import type { LiveStream } from "../mock/lives";

/** Stable soft sort: deliverable first, then original order. */
export function prioritizeDeliverable<T extends { deliversToMe?: boolean | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const av = a.deliversToMe === false ? 1 : 0;
    const bv = b.deliversToMe === false ? 1 : 0;
    return av - bv;
  });
}

export function mergeDeliveryFlags(
  lives: LiveStream[],
  flags: Map<string, boolean>,
): LiveStream[] {
  return lives.map((live) => {
    if (!live.sellerId || live.fictitious) return { ...live, deliversToMe: undefined };
    const hit = flags.get(live.sellerId);
    if (hit === undefined) return { ...live, deliversToMe: undefined };
    return { ...live, deliversToMe: hit };
  });
}
