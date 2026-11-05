import { LOCK_SIZE } from "./cbb-season";
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

function lockWindow(rankedIds: string[]) {
  return Math.min(LOCK_SIZE, rankedIds.length);
}

/** Adjacent pairs from the 1-seed vs 2-seed through Next 4 Out, then climb recommendations. */
export function nextScrubQuestion(draft: CbbDraft): CbbScrubQuestion | null {
  const done = new Set(draft.confirmedPairs);
  const phase = draft.phase ?? "lock";
  if (phase === "lock") {
    const end = lockWindow(draft.rankedIds);
    for (let i = 0; i < end - 1; i++) {
      const leftId = draft.rankedIds[i];
      const rightId = draft.rankedIds[i + 1];
      if (!leftId || !rightId) continue;
      if (done.has(scrubPairKey(leftId, rightId))) continue;
      return { leftId, rightId, leftRank: i + 1, rightRank: i + 2, phase: "lock" };
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
  if ((draft.phase ?? "lock") === "lock") {
    const done = new Set(draft.confirmedPairs);
    const end = lockWindow(draft.rankedIds);
    let count = 0;
    for (let i = 0; i < end - 1; i++) {
      const leftId = draft.rankedIds[i];
      const rightId = draft.rankedIds[i + 1];
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

export function applyScrubChoice(
  draft: CbbDraft,
  winnerId: string,
  loserId: string,
  recommendedIds: string[] = [],
): CbbDraft {
  let current = draft;
  if ((current.phase ?? "lock") === "lock" && !nextScrubQuestion(current)) {
    current = withRecommendPhase(current, recommendedIds);
  }
  const question = nextScrubQuestion(current);
  if (!question) return current;
  const pair = new Set([question.leftId, question.rightId]);
  if (!pair.has(winnerId) || !pair.has(loserId) || winnerId === loserId) return current;

  const history = pushHistory(current);
  const winnerIdx = current.rankedIds.indexOf(winnerId);
  const loserIdx = current.rankedIds.indexOf(loserId);

  if (question.phase === "recommend") {
    const climbingId = current.climbingId ?? question.rightId;
    const remaining = current.recommendQueue.filter((id) => id !== climbingId);
    const nextClimb = remaining[0] ?? null;
    const finishClimb = (rankedIds: string[], confirmed: string[]) => ({
      ...current,
      rankedIds: nextClimb ? [...rankedIds, nextClimb] : rankedIds,
      confirmedPairs: confirmed,
      climbingId: nextClimb,
      recommendQueue: remaining.slice(nextClimb ? 1 : 0),
      history,
    });
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
  if (!nextScrubQuestion(next)) {
    return withRecommendPhase(next, recommendedIds);
  }
  return next;
}

export function skipRemainingScrub(draft: CbbDraft, recommendedIds: string[] = []): CbbDraft {
  const history = pushHistory(draft);
  if ((draft.phase ?? "lock") === "lock") {
    const confirmed = new Set(draft.confirmedPairs);
    const end = lockWindow(draft.rankedIds);
    for (let i = 0; i < end - 1; i++) {
      const leftId = draft.rankedIds[i];
      const rightId = draft.rankedIds[i + 1];
      if (!leftId || !rightId) continue;
      confirmed.add(scrubPairKey(leftId, rightId));
    }
    return withRecommendPhase(
      { ...draft, confirmedPairs: [...confirmed], history },
      recommendedIds,
    );
  }
  const leftover = draft.recommendQueue.filter((id) => !draft.rankedIds.includes(id));
  return {
    ...draft,
    rankedIds: leftover.length ? [...draft.rankedIds, ...leftover] : [...draft.rankedIds],
    climbingId: null,
    recommendQueue: [],
    history,
  };
}

export function undoScrubChoice(draft: CbbDraft): CbbDraft | null {
  if (!draft.history.length) return null;
  const history = draft.history.slice();
  const prev = history.pop()!;
  return {
    ...draft,
    rankedIds: [...prev.rankedIds],
    confirmedPairs: [...prev.confirmedPairs],
    phase: prev.phase ?? "lock",
    climbingId: prev.climbingId ?? null,
    recommendQueue: [...(prev.recommendQueue ?? [])],
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
    phase: "lock",
    climbingId: null,
    recommendQueue: [],
    history: [],
  };
}
