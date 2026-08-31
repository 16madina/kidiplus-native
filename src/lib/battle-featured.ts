import type { LiveProductRow } from "./live-host";

function isExpiredAuction(product: LiveProductRow, now = Date.now()): boolean {
  return (
    product.status === "active" &&
    product.mode === "auction" &&
    !!product.auction_deadline_at &&
    Date.parse(product.auction_deadline_at) <= now
  );
}

/** Own / opponent mini-card: live auction first, else next playable item. */
export function pickBattleFeatured(
  products: LiveProductRow[],
  endedProductId?: string | null,
): LiveProductRow | null {
  const now = Date.now();
  const playable = products.filter((p) => {
    if (endedProductId && p.id === endedProductId) return false;
    if (p.status === "sold" || p.status === "out" || p.status === "unsold") return false;
    if (isExpiredAuction(p, now)) return false;
    return true;
  });
  const active = playable.find((p) => p.status === "active" && !isExpiredAuction(p, now));
  if (active) return active;
  const sorted = [...playable].sort((a, b) => a.position - b.position);
  return sorted[0] ?? null;
}

export function auctionSecondsLeft(product: LiveProductRow | null, now = Date.now()): number {
  if (!product || product.status !== "active" || !product.auction_deadline_at) return 0;
  return Math.max(0, Math.ceil((Date.parse(product.auction_deadline_at) - now) / 1000));
}

export function formatBattleCardClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function peerStatusKey(product: LiveProductRow): string {
  if (product.status === "active") return "battle.card.statusLive";
  if (product.status === "sold") return "battle.card.statusSold";
  if (product.status === "unsold") return "battle.card.statusUnsold";
  return "battle.card.statusWait";
}
