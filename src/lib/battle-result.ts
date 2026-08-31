import type { BattleFighterView } from "./battle-timing";
import type { HydratedBattle } from "./battles";

export function isLeaveReason(reason: string | null | undefined): boolean {
  return reason === "forfeit" || reason === "disconnected" || reason === "cancelled";
}

export function fighterHasSales(fighter: BattleFighterView | null): boolean {
  return !!fighter && (fighter.scoreAmountLive > 0 || fighter.scoreItems > 0);
}

export type BattleResultView = {
  winner: BattleFighterView | null;
  loser: BattleFighterView | null;
  abandon: boolean;
  leftName: string;
  youWon: boolean;
  showRematch: boolean;
  tie: boolean;
};

function sideFighter(battle: HydratedBattle, side: "a" | "b"): BattleFighterView {
  const live = battle.lives.find((l) => l.side === side);
  const part = battle.participants.find((p) => p.side === side || p.seller_id === live?.seller_id);
  return {
    sellerId: live?.seller_id ?? part?.seller_id ?? "",
    displayName: live?.display_name || part?.display_name || "",
    scoreAmountLive: part?.score_amount_live ?? 0,
    scoreItems: part?.score_items ?? 0,
    liveId: live?.live_id ?? null,
    avatarUrl: live?.avatar_url ?? null,
  };
}

/** Same abandon / scored-win rules as kidiplus.com `toSession()`. */
export function battleResultView(
  battle: HydratedBattle,
  selfSellerId?: string | null,
): BattleResultView {
  const sideA = sideFighter(battle, "a");
  const sideB = sideFighter(battle, "b");
  const winnerId = battle.session.live_winner_seller_id;
  const remaining =
    winnerId && winnerId === sideA.sellerId
      ? sideA
      : winnerId && winnerId === sideB.sellerId
        ? sideB
        : null;
  const leftMidFight = isLeaveReason(battle.session.end_reason);
  const abandon = leftMidFight && !fighterHasSales(remaining);
  const winner = abandon && !remaining ? null : remaining;
  const loser = winner
    ? winner.sellerId === sideA.sellerId
      ? sideB
      : sideA
    : null;
  const left = abandon
    ? remaining?.sellerId === sideA.sellerId
      ? sideB
      : sideA
    : loser;
  return {
    winner,
    loser,
    abandon,
    leftName: left?.displayName || "",
    youWon: !!winner && !!selfSellerId && winner.sellerId === selfSellerId,
    showRematch: !leftMidFight,
    tie: !winner && !abandon,
  };
}
