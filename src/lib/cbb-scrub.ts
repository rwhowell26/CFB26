import { applyWinnerAboveLoser } from "./ranking-logic";
import type { CbbDraft, CbbScrubCheckpoint } from "./cbb-types";

const MAX_HISTORY = 200;

export function scrubPairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export type CbbScrubQuestion = {
  leftId: string;
  rightId: string;
  leftRank: number;
  rightRank: number;
};

/** First unconfirmed adjacent pair from the top of the S-curve (1-seed vs 2-seed first). */
export function nextScrubQuestion(
  rankedIds: string[],
  confirmed: readonly string[],
): CbbScrubQuestion | null {
  const done = new Set(confirmed);
  for (let i = 0; i < rankedIds.length - 1; i++) {
    const leftId = rankedIds[i];
    const rightId = rankedIds[i + 1];
    if (!leftId || !rightId) continue;
    if (done.has(scrubPairKey(leftId, rightId))) continue;
    return { leftId, rightId, leftRank: i + 1, rightRank: i + 2 };
  }
  return null;
}

export function remainingScrubCount(rankedIds: string[], confirmed: readonly string[]): number {
  const done = new Set(confirmed);
  let count = 0;
  for (let i = 0; i < rankedIds.length - 1; i++) {
    const leftId = rankedIds[i];
    const rightId = rankedIds[i + 1];
    if (!leftId || !rightId) continue;
    if (!done.has(scrubPairKey(leftId, rightId))) count += 1;
  }
  return count;
}

function pushHistory(draft: CbbDraft): CbbScrubCheckpoint[] {
  const history = [
    ...draft.history,
    { rankedIds: [...draft.rankedIds], confirmedPairs: [...draft.confirmedPairs] },
  ];
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  return history;
}

export function applyScrubChoice(
  draft: CbbDraft,
  winnerId: string,
  loserId: string,
): CbbDraft {
  const question = nextScrubQuestion(draft.rankedIds, draft.confirmedPairs);
  if (!question) return draft;
  const pair = new Set([question.leftId, question.rightId]);
  if (!pair.has(winnerId) || !pair.has(loserId) || winnerId === loserId) return draft;

  const history = pushHistory(draft);
  const winnerIdx = draft.rankedIds.indexOf(winnerId);
  const loserIdx = draft.rankedIds.indexOf(loserId);
  const rankedIds =
    winnerIdx > loserIdx
      ? applyWinnerAboveLoser(draft.rankedIds, winnerId, loserId)
      : [...draft.rankedIds];

  return {
    ...draft,
    rankedIds,
    confirmedPairs: [...draft.confirmedPairs, scrubPairKey(winnerId, loserId)],
    history,
  };
}

export function skipRemainingScrub(draft: CbbDraft): CbbDraft {
  const question = nextScrubQuestion(draft.rankedIds, draft.confirmedPairs);
  if (!question) return draft;
  const confirmed = new Set(draft.confirmedPairs);
  for (let i = 0; i < draft.rankedIds.length - 1; i++) {
    const leftId = draft.rankedIds[i];
    const rightId = draft.rankedIds[i + 1];
    if (!leftId || !rightId) continue;
    confirmed.add(scrubPairKey(leftId, rightId));
  }
  return {
    ...draft,
    confirmedPairs: [...confirmed],
    history: pushHistory(draft),
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
    history: [],
  };
}
