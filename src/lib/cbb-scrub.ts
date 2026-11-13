import { applyWinnerAboveLoser } from "./ranking-logic";
import { FIELD_SIZE, FIRST_FOUR_OUT, NEXT_FOUR_OUT } from "./cbb-season";
import type { CbbDraft, CbbScrubCheckpoint, CbbScrubPhase } from "./cbb-types";

const MAX_HISTORY = 200;
const BUBBLE_SIZE = FIRST_FOUR_OUT + NEXT_FOUR_OUT;

export function scrubPairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export type CbbScrubQuestion = {
  leftId: string;
  rightId: string;
  leftRank: number;
  rightRank: number;
  phase: CbbScrubPhase;
};

/** Caps the at-large board at field at-larges + First 4 Out + Next 4 Out. */
export type ScrubWindow = {
  /** Fixed board length; used by tests. Ignored when conferenceCount is set. */
  lockEnd?: number;
  /** Conference champs who open an extra at-large spot once they are placed. */
  champIds?: Iterable<string>;
  conferenceCount?: number;
};

export function atLargeBoardEnd(rankedIds: string[], window?: ScrubWindow): number {
  if (window?.lockEnd != null && window.conferenceCount == null) {
    return Math.max(0, Math.min(window.lockEnd, rankedIds.length));
  }
  if (window?.conferenceCount == null) return rankedIds.length;
  const champs = new Set(window.champIds ?? []);
  let placedChamps = 0;
  let end = windowEnd(rankedIds.length, window, 0);
  for (let i = 0; i < end; i++) {
    const id = rankedIds[i];
    if (!id || !champs.has(id)) continue;
    placedChamps += 1;
    end = windowEnd(rankedIds.length, window, placedChamps);
  }
  return end;
}

function windowEnd(listLength: number, window: ScrubWindow | undefined, placedChamps: number): number {
  if (window?.lockEnd != null && window.conferenceCount == null) {
    return Math.max(0, Math.min(window.lockEnd, listLength));
  }
  if (window?.conferenceCount == null) return listLength;
  const reserved = Math.max(0, window.conferenceCount - placedChamps);
  return Math.min(listLength, FIELD_SIZE - reserved + BUBBLE_SIZE);
}

function adjacentPairList(draft: CbbDraft): string[] {
  return (draft.phase ?? "at-large") === "auto-bid" ? draft.autoBidIds : draft.rankedIds;
}

function rankOffset(draft: CbbDraft): number {
  return (draft.phase ?? "at-large") === "auto-bid" ? draft.rankedIds.length : 0;
}

function atLargePairEnd(draft: CbbDraft, window?: ScrubWindow): number {
  const list = draft.rankedIds;
  if ((draft.phase ?? "at-large") !== "at-large") return list.length;
  if (window?.lockEnd != null && window.conferenceCount == null) {
    return Math.max(0, Math.min(window.lockEnd, list.length));
  }
  if (window?.conferenceCount == null) return list.length;
  const champs = new Set(window.champIds ?? []);
  const done = new Set(draft.confirmedPairs);
  let placedChamps = 0;
  let end = windowEnd(list.length, window, 0);
  for (let i = 0; i < end - 1; i++) {
    const leftId = list[i];
    const rightId = list[i + 1];
    if (!leftId || !rightId) continue;
    if (!done.has(scrubPairKey(leftId, rightId))) return end;
    if (champs.has(leftId)) {
      placedChamps += 1;
      end = windowEnd(list.length, window, placedChamps);
    }
  }
  return end;
}

/** Adjacent pairs on the at-large board through Next 4 Out, then recommended climbs, then 12–16 auto-bids. */
export function nextScrubQuestion(draft: CbbDraft, window?: ScrubWindow): CbbScrubQuestion | null {
  const done = new Set(draft.confirmedPairs);
  const phase = draft.phase ?? "at-large";
  if (phase === "at-large") {
    const list = draft.rankedIds;
    const end = atLargePairEnd(draft, window);
    for (let i = 0; i < end - 1; i++) {
      const leftId = list[i];
      const rightId = list[i + 1];
      if (!leftId || !rightId) continue;
      if (done.has(scrubPairKey(leftId, rightId))) continue;
      return {
        leftId,
        rightId,
        leftRank: i + 1,
        rightRank: i + 2,
        phase,
      };
    }
    return null;
  }
  if (phase === "auto-bid") {
    const list = adjacentPairList(draft);
    const offset = rankOffset(draft);
    for (let i = 0; i < list.length - 1; i++) {
      const leftId = list[i];
      const rightId = list[i + 1];
      if (!leftId || !rightId) continue;
      if (done.has(scrubPairKey(leftId, rightId))) continue;
      return {
        leftId,
        rightId,
        leftRank: offset + i + 1,
        rightRank: offset + i + 2,
        phase,
      };
    }
    return null;
  }

  const climbingId = draft.climbingId ?? draft.recommendQueue[0] ?? null;
  if (!climbingId) return null;
  const idx = draft.rankedIds.indexOf(climbingId);
  if (idx <= 0) return null;
  const leftId = draft.rankedIds[idx - 1];
  const rightId = climbingId;
  if (!leftId) return null;
  return { leftId, rightId, leftRank: idx, rightRank: idx + 1, phase: "recommend" };
}

export function remainingScrubCount(draft: CbbDraft, window?: ScrubWindow): number {
  const phase = draft.phase ?? "at-large";
  if (phase === "at-large") {
    const done = new Set(draft.confirmedPairs);
    const list = draft.rankedIds;
    const end = atLargePairEnd(draft, window);
    let count = 0;
    for (let i = 0; i < end - 1; i++) {
      const leftId = list[i];
      const rightId = list[i + 1];
      if (!leftId || !rightId) continue;
      if (!done.has(scrubPairKey(leftId, rightId))) count += 1;
    }
    return count;
  }
  if (phase === "auto-bid") {
    const done = new Set(draft.confirmedPairs);
    const list = adjacentPairList(draft);
    let count = 0;
    for (let i = 0; i < list.length - 1; i++) {
      const leftId = list[i];
      const rightId = list[i + 1];
      if (!leftId || !rightId) continue;
      if (!done.has(scrubPairKey(leftId, rightId))) count += 1;
    }
    return count;
  }
  const remainingQueue = draft.climbingId
    ? [draft.climbingId, ...draft.recommendQueue.filter((id) => id !== draft.climbingId)]
    : [...draft.recommendQueue];
  return remainingQueue.length;
}

function pushHistory(draft: CbbDraft): CbbScrubCheckpoint[] {
  const history = [
    ...draft.history,
    {
      rankedIds: [...draft.rankedIds],
      confirmedPairs: [...draft.confirmedPairs],
      phase: draft.phase,
      climbingId: draft.climbingId,
      recommendQueue: [...draft.recommendQueue],
      autoBidIds: [...draft.autoBidIds],
    },
  ];
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  return history;
}

function uniqueKeepOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function withRecommendPhase(draft: CbbDraft, recommendedIds: string[], window?: ScrubWindow): CbbDraft {
  const end = atLargeBoardEnd(draft.rankedIds, window);
  const board = draft.rankedIds.slice(0, end);
  const extras = draft.rankedIds.slice(end);
  const have = new Set(board);
  const newcomers = uniqueKeepOrder([
    ...extras.filter((id) => !have.has(id)),
    ...recommendedIds.filter((id) => !have.has(id)),
  ]);
  if (!newcomers.length) {
    return { ...draft, phase: "recommend", rankedIds: board, climbingId: null, recommendQueue: [] };
  }
  const climbingId = newcomers[0]!;
  return {
    ...draft,
    phase: "recommend",
    rankedIds: [...board, climbingId],
    climbingId,
    recommendQueue: newcomers.slice(1),
  };
}

function withAutoBidPhase(draft: CbbDraft, autoBidIds: string[]): CbbDraft {
  const have = new Set(draft.rankedIds);
  return {
    ...draft,
    phase: "auto-bid",
    climbingId: null,
    recommendQueue: [],
    autoBidIds: autoBidIds.filter((id) => !have.has(id)),
  };
}

function afterAtLargeOrRecommend(
  draft: CbbDraft,
  recommendedIds: string[],
  autoBidIds: string[],
  window?: ScrubWindow,
): CbbDraft {
  if (nextScrubQuestion(draft, window)) return draft;
  if ((draft.phase ?? "at-large") === "at-large") {
    const rec = withRecommendPhase(draft, recommendedIds, window);
    if (nextScrubQuestion(rec, window)) return rec;
    return withAutoBidPhase(rec, autoBidIds);
  }
  if (draft.phase === "recommend") {
    return withAutoBidPhase(draft, autoBidIds);
  }
  return draft;
}

function boardAfterClimbEnds(
  rankedIds: string[],
  climbingId: string,
  window?: ScrubWindow,
): string[] {
  const idx = rankedIds.indexOf(climbingId);
  const endGuess = atLargeBoardEnd(rankedIds, window);
  if (idx < 0 || idx >= endGuess) {
    const kept = rankedIds.filter((id) => id !== climbingId);
    return kept.slice(0, atLargeBoardEnd(kept, window));
  }
  return rankedIds.slice(0, atLargeBoardEnd(rankedIds, window));
}

export function applyScrubChoice(
  draft: CbbDraft,
  winnerId: string,
  loserId: string,
  recommendedIds: string[] = [],
  autoBidIds: string[] = [],
  window?: ScrubWindow,
): CbbDraft {
  let current = afterAtLargeOrRecommend(draft, recommendedIds, autoBidIds, window);
  const question = nextScrubQuestion(current, window);
  if (!question) return current;
  const pair = new Set([question.leftId, question.rightId]);
  if (!pair.has(winnerId) || !pair.has(loserId) || winnerId === loserId) return current;

  const history = pushHistory(current);
  if (question.phase === "recommend") {
    const climbingId = current.climbingId ?? question.rightId;
    const remaining = current.recommendQueue.filter((id) => id !== climbingId);
    const nextClimb = remaining[0] ?? null;
    const winnerIdx = current.rankedIds.indexOf(winnerId);
    const loserIdx = current.rankedIds.indexOf(loserId);
    const finishClimb = (rankedIds: string[], confirmed: string[]) => {
      const board = boardAfterClimbEnds(rankedIds, climbingId, window);
      return afterAtLargeOrRecommend(
        {
          ...current,
          rankedIds: nextClimb ? [...board, nextClimb] : board,
          confirmedPairs: confirmed,
          climbingId: nextClimb,
          recommendQueue: remaining.slice(nextClimb ? 1 : 0),
          history,
        },
        recommendedIds,
        autoBidIds,
        window,
      );
    };
    if (winnerId === climbingId) {
      const rankedIds =
        winnerIdx > loserIdx
          ? applyWinnerAboveLoser(current.rankedIds, winnerId, loserId)
          : [...current.rankedIds];
      if (rankedIds.indexOf(climbingId) <= 0) {
        return finishClimb(rankedIds, current.confirmedPairs);
      }
      return { ...current, rankedIds, history };
    }
    return finishClimb(current.rankedIds, [
      ...current.confirmedPairs,
      scrubPairKey(winnerId, loserId),
    ]);
  }

  if (question.phase === "auto-bid") {
    const winnerIdx = current.autoBidIds.indexOf(winnerId);
    const loserIdx = current.autoBidIds.indexOf(loserId);
    const autoBids =
      winnerIdx > loserIdx
        ? applyWinnerAboveLoser(current.autoBidIds, winnerId, loserId)
        : [...current.autoBidIds];
    return {
      ...current,
      autoBidIds: autoBids,
      confirmedPairs: [...current.confirmedPairs, scrubPairKey(winnerId, loserId)],
      history,
    };
  }

  const winnerIdx = current.rankedIds.indexOf(winnerId);
  const loserIdx = current.rankedIds.indexOf(loserId);
  const rankedIds =
    winnerIdx > loserIdx
      ? applyWinnerAboveLoser(current.rankedIds, winnerId, loserId)
      : [...current.rankedIds];
  const next: CbbDraft = {
    ...current,
    rankedIds,
    confirmedPairs: [...current.confirmedPairs, scrubPairKey(winnerId, loserId)],
    history,
  };
  return afterAtLargeOrRecommend(next, recommendedIds, autoBidIds, window);
}

export function skipRemainingScrub(
  draft: CbbDraft,
  recommendedIds: string[] = [],
  autoBidIds: string[] = [],
  window?: ScrubWindow,
): CbbDraft {
  const history = pushHistory(draft);
  const phase = draft.phase ?? "at-large";
  if (phase === "at-large") {
    const confirmed = new Set(draft.confirmedPairs);
    const end = atLargeBoardEnd(draft.rankedIds, window);
    for (let i = 0; i < end - 1; i++) {
      const leftId = draft.rankedIds[i];
      const rightId = draft.rankedIds[i + 1];
      if (!leftId || !rightId) continue;
      confirmed.add(scrubPairKey(leftId, rightId));
    }
    return afterAtLargeOrRecommend(
      { ...draft, confirmedPairs: [...confirmed], history },
      recommendedIds,
      autoBidIds,
      window,
    );
  }
  if (phase === "recommend") {
    const board = boardAfterClimbEnds(
      draft.rankedIds,
      draft.climbingId ?? draft.rankedIds[draft.rankedIds.length - 1] ?? "",
      window,
    );
    return afterAtLargeOrRecommend(
      {
        ...draft,
        rankedIds: board,
        climbingId: null,
        recommendQueue: [],
        history,
      },
      recommendedIds,
      autoBidIds,
      window,
    );
  }
  const confirmed = new Set(draft.confirmedPairs);
  for (let i = 0; i < draft.autoBidIds.length - 1; i++) {
    const leftId = draft.autoBidIds[i];
    const rightId = draft.autoBidIds[i + 1];
    if (!leftId || !rightId) continue;
    confirmed.add(scrubPairKey(leftId, rightId));
  }
  return { ...draft, confirmedPairs: [...confirmed], history };
}

export function undoScrubChoice(draft: CbbDraft): CbbDraft | null {
  if (!draft.history.length) return null;
  const history = draft.history.slice();
  const prev = history.pop()!;
  return {
    ...draft,
    rankedIds: [...prev.rankedIds],
    confirmedPairs: [...prev.confirmedPairs],
    phase: prev.phase ?? "at-large",
    climbingId: prev.climbingId ?? null,
    recommendQueue: [...(prev.recommendQueue ?? [])],
    autoBidIds: [...(prev.autoBidIds ?? [])],
    history,
  };
}

export function emptyDraft(
  rankedIds: string[],
  basedOnId: string | null,
  now = new Date(),
): CbbDraft {
  return {
    id: `draft-${now.getTime()}`,
    startedAt: now.toISOString(),
    basedOnId,
    rankedIds: [...rankedIds],
    confirmedPairs: [],
    phase: "at-large",
    climbingId: null,
    recommendQueue: [],
    autoBidIds: [],
    history: [],
  };
}
