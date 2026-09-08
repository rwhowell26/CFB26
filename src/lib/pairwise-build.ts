import { FBS_TEAM_COUNT, WEEK_ONE } from "./season";
import type { PairwiseCheckpoint, PairwiseSession, RankingStore } from "./types";

export type PairwiseKind = "seed" | "pick-next" | "insert";

export type PairwiseQuestion = {
  kind: PairwiseKind;
  leftId: string;
  rightId: string;
  mid?: number;
};

/** After this many binary insertions, ask two unplaced teams who should go next. */
export const PAIRWISE_PICK_EVERY = 2;
const MAX_HISTORY = 200;

export function emptyPairwiseSession(week: number): PairwiseSession {
  return {
    week,
    queue: [],
    insertingId: null,
    lo: 0,
    hi: 0,
    sincePair: PAIRWISE_PICK_EVERY,
    history: [],
  };
}

export function snapshotCheckpoint(
  rankedIds: string[],
  session: PairwiseSession,
): PairwiseCheckpoint {
  return {
    rankedIds: [...rankedIds],
    queue: [...session.queue],
    insertingId: session.insertingId,
    lo: session.lo,
    hi: session.hi,
    sincePair: session.sincePair,
  };
}

function withHistory(
  rankedIds: string[],
  session: PairwiseSession,
): PairwiseSession {
  const history = [...session.history, snapshotCheckpoint(rankedIds, session)];
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  return { ...session, history };
}

/** Week 1 draft/snapshot when the current week is empty; otherwise the current ballot. */
export function seedRankedIds(store: RankingStore, week: number): string[] {
  const current = store.drafts[String(week)] ?? [];
  if (current.length) return [...current];
  if (week !== WEEK_ONE) {
    const week1Draft = store.drafts[String(WEEK_ONE)] ?? [];
    if (week1Draft.length) return [...week1Draft];
    const week1Snap = store.snapshots[String(WEEK_ONE)];
    if (week1Snap?.rankedIds.length) return [...week1Snap.rankedIds];
  }
  return [];
}

export function initPairwiseSession(
  week: number,
  rankedIds: string[],
  orderedRemaining: string[],
): PairwiseSession {
  const ranked = new Set(rankedIds);
  return {
    ...emptyPairwiseSession(week),
    queue: orderedRemaining.filter((id) => !ranked.has(id)),
  };
}

export function reconcilePairwiseSession(
  session: PairwiseSession,
  week: number,
  rankedIds: string[],
  allTeamIds: string[],
  orderRemaining: (ids: string[]) => string[],
): PairwiseSession {
  if (session.week !== week) {
    const ranked = new Set(rankedIds);
    return initPairwiseSession(
      week,
      rankedIds,
      orderRemaining(allTeamIds.filter((id) => !ranked.has(id))),
    );
  }

  const ranked = new Set(rankedIds);
  const kept = session.queue.filter((id) => !ranked.has(id) && id !== session.insertingId);
  const known = new Set(kept);
  if (session.insertingId && !ranked.has(session.insertingId)) {
    known.add(session.insertingId);
  }
  const missing = orderRemaining(
    allTeamIds.filter((id) => !ranked.has(id) && !known.has(id)),
  );
  const queue = [...kept, ...missing];

  let { insertingId, lo, hi } = session;
  if (rankedIds.length === 0 || (insertingId && ranked.has(insertingId))) {
    insertingId = null;
    lo = 0;
    hi = 0;
  }
  if (insertingId && (lo < 0 || hi < 0 || lo > rankedIds.length || hi > rankedIds.length)) {
    lo = 0;
    hi = rankedIds.length;
  }

  return { ...session, week, queue, insertingId, lo, hi };
}

function shouldAskUnrankedPair(session: PairwiseSession, rankedCount: number, remaining: number) {
  if (session.insertingId) return false;
  if (remaining < 2) return false;
  if (rankedCount === 0) return true;
  if (rankedCount < 2) return true;
  return session.sincePair >= PAIRWISE_PICK_EVERY;
}

function insertAt(rankedIds: string[], teamId: string, index: number): string[] {
  if (rankedIds.includes(teamId)) return rankedIds;
  const next = [...rankedIds];
  const clamped = Math.max(0, Math.min(index, next.length));
  next.splice(clamped, 0, teamId);
  return next;
}

export function preparePairwiseQuestion(
  session: PairwiseSession,
  rankedIds: string[],
): { session: PairwiseSession; rankedIds: string[]; question: PairwiseQuestion | null } {
  const rankedSet = new Set(rankedIds);
  const queue = session.queue.filter((id) => !rankedSet.has(id) && id !== session.insertingId);
  let current: PairwiseSession =
    queue.length === session.queue.length ? session : { ...session, queue };

  if (current.insertingId && rankedSet.has(current.insertingId)) {
    current = { ...current, insertingId: null, lo: 0, hi: 0 };
  }

  if (current.insertingId) {
    if (current.lo >= current.hi) {
      const nextRanked = insertAt(rankedIds, current.insertingId, current.lo);
      return preparePairwiseQuestion(
        {
          ...current,
          insertingId: null,
          lo: 0,
          hi: 0,
          sincePair: current.sincePair + 1,
        },
        nextRanked,
      );
    }
    const mid = Math.floor((current.lo + current.hi) / 2);
    const opp = rankedIds[mid];
    if (!opp || opp === current.insertingId) {
      return preparePairwiseQuestion({ ...current, insertingId: null, lo: 0, hi: 0 }, rankedIds);
    }
    return {
      session: current,
      rankedIds,
      question: {
        kind: "insert",
        leftId: current.insertingId,
        rightId: opp,
        mid,
      },
    };
  }

  if (!queue.length) {
    return { session: { ...current, queue }, rankedIds, question: null };
  }

  if (rankedIds.length === 0 && queue.length === 1) {
    return {
      session: { ...current, queue: [] },
      rankedIds: [queue[0]],
      question: null,
    };
  }

  if (shouldAskUnrankedPair(current, rankedIds.length, queue.length)) {
    return {
      session: { ...current, queue },
      rankedIds,
      question: {
        kind: rankedIds.length === 0 ? "seed" : "pick-next",
        leftId: queue[0],
        rightId: queue[1],
      },
    };
  }

  const insertingId = queue[0];
  return preparePairwiseQuestion(
    {
      ...current,
      queue: queue.slice(1),
      insertingId,
      lo: 0,
      hi: rankedIds.length,
    },
    rankedIds,
  );
}

export function applyPairwiseChoice(
  session: PairwiseSession,
  rankedIds: string[],
  winnerId: string,
  loserId: string,
): { session: PairwiseSession; rankedIds: string[] } {
  const prepared = preparePairwiseQuestion(session, rankedIds);
  const question = prepared.question;
  if (!question) {
    return { session: prepared.session, rankedIds: prepared.rankedIds };
  }

  const pair = new Set([question.leftId, question.rightId]);
  if (!pair.has(winnerId) || !pair.has(loserId) || winnerId === loserId) {
    return { session: prepared.session, rankedIds: prepared.rankedIds };
  }

  const tracked = withHistory(prepared.rankedIds, prepared.session);

  if (question.kind === "seed") {
    return {
      rankedIds: [winnerId, loserId],
      session: {
        ...tracked,
        queue: tracked.queue.filter((id) => id !== winnerId && id !== loserId),
        insertingId: null,
        lo: 0,
        hi: 0,
        sincePair: 0,
      },
    };
  }

  if (question.kind === "pick-next") {
    return {
      rankedIds: prepared.rankedIds,
      session: {
        ...tracked,
        queue: tracked.queue.filter((id) => id !== winnerId),
        insertingId: winnerId,
        lo: 0,
        hi: prepared.rankedIds.length,
        sincePair: 0,
      },
    };
  }

  const mid = question.mid ?? Math.floor((tracked.lo + tracked.hi) / 2);
  let lo = tracked.lo;
  let hi = tracked.hi;
  if (winnerId === tracked.insertingId) hi = mid;
  else lo = mid + 1;

  if (lo >= hi) {
    const insertingId = tracked.insertingId;
    if (!insertingId) {
      return { session: { ...tracked, lo, hi }, rankedIds: prepared.rankedIds };
    }
    return {
      rankedIds: insertAt(prepared.rankedIds, insertingId, lo),
      session: {
        ...tracked,
        insertingId: null,
        lo: 0,
        hi: 0,
        sincePair: tracked.sincePair + 1,
      },
    };
  }

  return {
    rankedIds: prepared.rankedIds,
    session: { ...tracked, lo, hi },
  };
}

export function undoPairwiseChoice(
  session: PairwiseSession,
): { session: PairwiseSession; rankedIds: string[] } | null {
  if (!session.history.length) return null;
  const history = session.history.slice();
  const prev = history.pop()!;
  return {
    rankedIds: [...prev.rankedIds],
    session: {
      week: session.week,
      queue: [...prev.queue],
      insertingId: prev.insertingId,
      lo: prev.lo,
      hi: prev.hi,
      sincePair: prev.sincePair,
      history,
    },
  };
}

export function pairwiseProgress(rankedCount: number, total = FBS_TEAM_COUNT) {
  return { ranked: rankedCount, total, remaining: Math.max(0, total - rankedCount) };
}

export function questionCopy(kind: PairwiseKind): { eyebrow: string; prompt: string } {
  if (kind === "seed") {
    return {
      eyebrow: "Build · start the ballot",
      prompt: "Who belongs higher? Both land on the ballot, winner at #1.",
    };
  }
  if (kind === "pick-next") {
    return {
      eyebrow: "Build · who goes next",
      prompt: "Who belongs higher among these two still-unplaced teams? Winner is inserted next.",
    };
  }
  return {
    eyebrow: "Build · place on the ballot",
    prompt: "Who belongs higher? Your pick narrows where the unplaced team sits.",
  };
}
