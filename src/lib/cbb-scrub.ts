import { applyWinnerAboveLoser } from "./ranking-logic";
import type { CbbDraft, CbbScrubCheckpoint, CbbScrubPhase } from "./cbb-types";

const MAX_HISTORY = 200;

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

function adjacentPairList(draft: CbbDraft): string[] {
  return (draft.phase ?? "at-large") === "auto-bid" ? draft.autoBidIds : draft.rankedIds;
}

function rankOffset(draft: CbbDraft): number {
  return (draft.phase ?? "at-large") === "auto-bid" ? draft.rankedIds.length : 0;
}

/** Adjacent pairs on the at-large board, then recommended climbs, then 12–16 auto-bids. */
export function nextScrubQuestion(draft: CbbDraft): CbbScrubQuestion | null {
  const done = new Set(draft.confirmedPairs);
  const phase = draft.phase ?? "at-large";
  if (phase === "at-large" || phase === "auto-bid") {
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

export function remainingScrubCount(draft: CbbDraft): number {
  const phase = draft.phase ?? "at-large";
  if (phase === "at-large" || phase === "auto-bid") {
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

function withRecommendPhase(draft: CbbDraft, recommendedIds: string[]): CbbDraft {
  const have = new Set(draft.rankedIds);
  const newcomers = recommendedIds.filter((id) => !have.has(id));
  if (!newcomers.length) {
    return { ...draft, phase: "recommend", climbingId: null, recommendQueue: [] };
  }
  const climbingId = newcomers[0]!;
  return {
    ...draft,
    phase: "recommend",
    rankedIds: [...draft.rankedIds, climbingId],
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
): CbbDraft {
  if (nextScrubQuestion(draft)) return draft;
  if ((draft.phase ?? "at-large") === "at-large") {
    const rec = withRecommendPhase(draft, recommendedIds);
    if (nextScrubQuestion(rec)) return rec;
    return withAutoBidPhase(rec, autoBidIds);
  }
  if (draft.phase === "recommend") {
    return withAutoBidPhase(draft, autoBidIds);
  }
  return draft;
}

export function applyScrubChoice(
  draft: CbbDraft,
  winnerId: string,
  loserId: string,
  recommendedIds: string[] = [],
  autoBidIds: string[] = [],
): CbbDraft {
  let current = afterAtLargeOrRecommend(draft, recommendedIds, autoBidIds);
  const question = nextScrubQuestion(current);
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
    const finishClimb = (rankedIds: string[], confirmed: string[]) =>
      afterAtLargeOrRecommend(
        {
          ...current,
          rankedIds: nextClimb ? [...rankedIds, nextClimb] : rankedIds,
          confirmedPairs: confirmed,
          climbingId: nextClimb,
          recommendQueue: remaining.slice(nextClimb ? 1 : 0),
          history,
        },
        recommendedIds,
        autoBidIds,
      );
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
  return afterAtLargeOrRecommend(next, recommendedIds, autoBidIds);
}

export function skipRemainingScrub(
  draft: CbbDraft,
  recommendedIds: string[] = [],
  autoBidIds: string[] = [],
): CbbDraft {
  const history = pushHistory(draft);
  const phase = draft.phase ?? "at-large";
  if (phase === "at-large") {
    const confirmed = new Set(draft.confirmedPairs);
    for (let i = 0; i < draft.rankedIds.length - 1; i++) {
      const leftId = draft.rankedIds[i];
      const rightId = draft.rankedIds[i + 1];
      if (!leftId || !rightId) continue;
      confirmed.add(scrubPairKey(leftId, rightId));
    }
    return afterAtLargeOrRecommend(
      { ...draft, confirmedPairs: [...confirmed], history },
      recommendedIds,
      autoBidIds,
    );
  }
  if (phase === "recommend") {
    const leftover = draft.recommendQueue.filter((id) => !draft.rankedIds.includes(id));
    return afterAtLargeOrRecommend(
      {
        ...draft,
        rankedIds: leftover.length ? [...draft.rankedIds, ...leftover] : [...draft.rankedIds],
        climbingId: null,
        recommendQueue: [],
        history,
      },
      recommendedIds,
      autoBidIds,
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
