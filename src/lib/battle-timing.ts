import type {
  BattleLiveRow,
  BattleParticipantRow,
  BattleSessionRow,
  HydratedBattle,
} from "./battles";

const COUNTDOWN_SEC = 15;
const SUDDEN_DEATH_SEC = 60;

export type BattleFighterView = {
  sellerId: string;
  displayName: string;
  scoreAmountLive: number;
  scoreItems: number;
  liveId: string | null;
  avatarUrl: string | null;
};

export function battleCountdownMs(session: BattleSessionRow, now: number): number {
  if (session.status !== "running" || session.sudden_death) return 0;
  if (!session.started_at) return 0;
  return Math.max(0, Date.parse(session.started_at) + COUNTDOWN_SEC * 1000 - now);
}

export function battleRemainingMs(session: BattleSessionRow, now: number): number {
  if (session.status !== "running" && session.status !== "sudden_death") return 0;
  if (session.sudden_death) {
    const start = session.sudden_death_at ?? session.ends_at;
    if (!start) return 0;
    return Math.max(0, Date.parse(start) + SUDDEN_DEATH_SEC * 1000 - now);
  }
  if (battleCountdownMs(session, now) > 0) return session.duration_sec * 1000;
  if (!session.ends_at) return 0;
  return Math.max(0, Date.parse(session.ends_at) - now);
}

export function formatBattleClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function battleDockMetrics(insetsTop: number, windowHeight: number) {
  const dockTop = insetsTop + 124;
  const dockHeight = Math.min(windowHeight * 0.36, 300);
  return {
    dockTop,
    dockHeight,
    cardTop: dockTop + dockHeight + 6,
    hudTop: insetsTop + 48,
  };
}

function toFighter(
  live: BattleLiveRow | undefined,
  participants: BattleParticipantRow[],
): BattleFighterView {
  const p = live ? participants.find((row) => row.seller_id === live.seller_id) : undefined;
  return {
    sellerId: live?.seller_id ?? "",
    displayName: live?.display_name ?? "",
    scoreAmountLive: p?.score_amount_live ?? 0,
    scoreItems: p?.score_items ?? 0,
    liveId: live?.live_id ?? null,
    avatarUrl: live?.avatar_url ?? null,
  };
}

/** Anchor live (the one you opened) is always LEFT. */
export function battleFighters(battle: HydratedBattle, anchorLiveId: string): {
  left: BattleFighterView;
  right: BattleFighterView;
} {
  const mine = battle.lives.find((l) => l.live_id === anchorLiveId) ?? battle.lives[0];
  const other = battle.lives.find((l) => l.live_id !== mine?.live_id);
  return {
    left: toFighter(mine, battle.participants),
    right: toFighter(other, battle.participants),
  };
}
