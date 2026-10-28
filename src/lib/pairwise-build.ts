import { applyWinnerAboveLoser } from "./ranking-logic";
import { FBS_TEAM_COUNT } from "./season";
import type { PairwiseCheckpoint, PairwiseSession, RankingStore } from "./types";

export type PairwiseKind = "seed" | "pick-next" | "insert" | "scrub" | "blend";

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
    scrubConfirmed: [],
    scrubPhase: 1,
    scrubClimbingId: null,
    scrubBlendGroup: null,
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
    scrubConfirmed: [...(session.scrubConfirmed ?? [])],
    scrubPhase: session.scrubPhase ?? 1,
    scrubClimbingId: session.scrubClimbingId ?? null,
    scrubBlendGroup: session.scrubBlendGroup ?? null,
  };
}

export function scrubPairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function lossesOf(
  id: string,
  records: Map<string, { wins: number; losses: number }>,
) {
  return records.get(id)?.losses ?? 0;
}

function sameLossAdjacent(
  rankedIds: string[],
  records: Map<string, { wins: number; losses: number }>,
  confirmed: readonly string[],
): Array<{ leftId: string; rightId: string }> {
  const done = new Set(confirmed);
  const pairs: Array<{ leftId: string; rightId: string }> = [];
  for (let i = 0; i < rankedIds.length - 1; i++) {
    const leftId = rankedIds[i];
    const rightId = rankedIds[i + 1];
    if (lossesOf(leftId, records) !== lossesOf(rightId, records)) continue;
    if (done.has(scrubPairKey(leftId, rightId))) continue;
    pairs.push({ leftId, rightId });
  }
  return pairs;
}

export function nextScrubQuestion(
  rankedIds: string[],
  records: Map<string, { wins: number; losses: number }>,
  confirmed: readonly string[],
): PairwiseQuestion | null {
  const next = sameLossAdjacent(rankedIds, records, confirmed)[0];
  if (!next) return null;
  return { kind: "scrub", leftId: next.leftId, rightId: next.rightId };
}

function nextLossCount(
  rankedIds: string[],
  records: Map<string, { wins: number; losses: number }>,
  current: number,
): number | null {
  let min = Infinity;
  for (const id of rankedIds) {
    const losses = lossesOf(id, records);
    if (losses > current && losses < min) min = losses;
  }
  return Number.isFinite(min) ? min : null;
}

function firstBoundaryForGroup(
  rankedIds: string[],
  records: Map<string, { wins: number; losses: number }>,
  group: number,
  confirmed: readonly string[],
): { leftId: string; rightId: string } | null {
  const done = new Set(confirmed);
  for (let i = 0; i < rankedIds.length - 1; i++) {
    const leftId = rankedIds[i];
    const rightId = rankedIds[i + 1];
    if (lossesOf(rightId, records) !== group) continue;
    if (lossesOf(leftId, records) >= group) continue;
    if (done.has(scrubPairKey(leftId, rightId))) continue;
    return { leftId, rightId };
  }
  return null;
}

export function remainingScrubCount(
  rankedIds: string[],
  records: Map<string, { wins: number; losses: number }>,
  session: PairwiseSession,
): number {
  const confirmed = session.scrubConfirmed ?? [];
  const phase = session.scrubPhase ?? 1;
  if (phase <= 1) return sameLossAdjacent(rankedIds, records, confirmed).length;
  if (phase >= 3) return 0;
  if (session.scrubClimbingId) return 1;
  let group = session.scrubBlendGroup;
  if (group == null) group = nextLossCount(rankedIds, records, -1);
  let count = 0;
  while (group != null) {
    if (firstBoundaryForGroup(rankedIds, records, group, confirmed)) count += 1;
    group = nextLossCount(rankedIds, records, group);
  }
  return count;
}

export function skipCurrentScrubPhase(session: PairwiseSession): PairwiseSession {
  const phase = session.scrubPhase ?? 1;
  if (phase <= 1) {
    return {
      ...session,
      scrubPhase: 2,
      scrubClimbingId: null,
      scrubBlendGroup: null,
    };
  }
  return {
    ...session,
    scrubPhase: 3,
    scrubClimbingId: null,
  };
}

function prepareScrubQuestion(
  session: PairwiseSession,
  rankedIds: string[],
  records: Map<string, { wins: number; losses: number }>,
): { session: PairwiseSession; rankedIds: string[]; question: PairwiseQuestion | null } {
  let current: PairwiseSession = {
    ...session,
    queue: [],
    insertingId: null,
    lo: 0,
    hi: 0,
  };
  const confirmed = current.scrubConfirmed ?? [];
  const phase = current.scrubPhase ?? 1;

  if (phase <= 1) {
    const question = nextScrubQuestion(rankedIds, records, confirmed);
    if (question) {
      return { session: { ...current, scrubPhase: 1 }, rankedIds, question };
    }
    current = {
      ...current,
      scrubPhase: 2,
      scrubClimbingId: null,
      scrubBlendGroup: current.scrubBlendGroup ?? null,
    };
  }

  if ((current.scrubPhase ?? 2) >= 3) {
    return { session: { ...current, scrubPhase: 3, scrubClimbingId: null }, rankedIds, question: null };
  }

  const climbingId = current.scrubClimbingId ?? null;
  if (climbingId) {
    const idx = rankedIds.indexOf(climbingId);
    if (idx > 0) {
      return {
        session: { ...current, scrubPhase: 2 },
        rankedIds,
        question: { kind: "blend", leftId: rankedIds[idx - 1], rightId: climbingId },
      };
    }
    current = { ...current, scrubClimbingId: null };
  }

  let group = current.scrubBlendGroup;
  if (group == null) {
    const fewest = nextLossCount(rankedIds, records, -1);
    group = fewest == null ? null : nextLossCount(rankedIds, records, fewest);
  }

  while (group != null) {
    const pair = firstBoundaryForGroup(rankedIds, records, group, confirmed);
    if (pair) {
      return {
        session: {
          ...current,
          scrubPhase: 2,
          scrubBlendGroup: group,
          scrubClimbingId: null,
        },
        rankedIds,
        question: { kind: "blend", leftId: pair.leftId, rightId: pair.rightId },
      };
    }
    group = nextLossCount(rankedIds, records, group);
  }

  return {
    session: { ...current, scrubPhase: 3, scrubClimbingId: null, scrubBlendGroup: group },
    rankedIds,
    question: null,
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

/** Current week's draft only — do not copy a finished prior week onto a new week. */
export function seedRankedIds(store: RankingStore, week: number): string[] {
  return [...(store.drafts[String(week)] ?? [])];
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
  records?: Map<string, { wins: number; losses: number }>,
  totalTeams = FBS_TEAM_COUNT,
): { session: PairwiseSession; rankedIds: string[]; question: PairwiseQuestion | null } {
  if (totalTeams > 0 && rankedIds.length >= totalTeams) {
    if (!records) {
      return {
        session: { ...session, queue: [], insertingId: null, lo: 0, hi: 0 },
        rankedIds,
        question: null,
      };
    }
    return prepareScrubQuestion(session, rankedIds, records);
  }

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
        records,
        totalTeams,
      );
    }
    const mid = Math.floor((current.lo + current.hi) / 2);
    const opp = rankedIds[mid];
    if (!opp || opp === current.insertingId) {
      return preparePairwiseQuestion(
        { ...current, insertingId: null, lo: 0, hi: 0 },
        rankedIds,
        records,
        totalTeams,
      );
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
    records,
    totalTeams,
  );
}

export function applyPairwiseChoice(
  session: PairwiseSession,
  rankedIds: string[],
  winnerId: string,
  loserId: string,
  records?: Map<string, { wins: number; losses: number }>,
  totalTeams = FBS_TEAM_COUNT,
): { session: PairwiseSession; rankedIds: string[] } {
  const prepared = preparePairwiseQuestion(session, rankedIds, records, totalTeams);
  const question = prepared.question;
  if (!question) {
    return { session: prepared.session, rankedIds: prepared.rankedIds };
  }

  const pair = new Set([question.leftId, question.rightId]);
  if (!pair.has(winnerId) || !pair.has(loserId) || winnerId === loserId) {
    return { session: prepared.session, rankedIds: prepared.rankedIds };
  }

  const tracked = withHistory(prepared.rankedIds, prepared.session);

  if (question.kind === "scrub" || question.kind === "blend") {
    const winnerIdx = prepared.rankedIds.indexOf(winnerId);
    const loserIdx = prepared.rankedIds.indexOf(loserId);
    const confirmed = [
      ...(tracked.scrubConfirmed ?? []),
      scrubPairKey(winnerId, loserId),
    ];

    if (question.kind === "blend") {
      const lowerId = question.rightId;
      if (winnerId === lowerId) {
        const ranked =
          winnerIdx > loserIdx
            ? applyWinnerAboveLoser(prepared.rankedIds, winnerId, loserId)
            : prepared.rankedIds;
        return {
          rankedIds: ranked,
          session: {
            ...tracked,
            insertingId: null,
            lo: 0,
            hi: 0,
            queue: [],
            scrubPhase: 2,
            scrubClimbingId: winnerId,
            scrubConfirmed: confirmed,
          },
        };
      }

      const wasClimbing = Boolean(tracked.scrubClimbingId);
      let blendGroup = tracked.scrubBlendGroup ?? null;
      if (!wasClimbing && records) {
        blendGroup = nextLossCount(
          prepared.rankedIds,
          records,
          blendGroup ?? lossesOf(lowerId, records),
        );
      }
      return {
        rankedIds: prepared.rankedIds,
        session: {
          ...tracked,
          insertingId: null,
          lo: 0,
          hi: 0,
          queue: [],
          scrubPhase: 2,
          scrubClimbingId: null,
          scrubBlendGroup: wasClimbing ? tracked.scrubBlendGroup ?? null : blendGroup,
          scrubConfirmed: confirmed,
        },
      };
    }

    const ranked =
      winnerIdx > loserIdx
        ? applyWinnerAboveLoser(prepared.rankedIds, winnerId, loserId)
        : prepared.rankedIds;
    return {
      rankedIds: ranked,
      session: {
        ...tracked,
        insertingId: null,
        lo: 0,
        hi: 0,
        queue: [],
        scrubPhase: 1,
        scrubConfirmed: confirmed,
      },
    };
  }

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
      scrubConfirmed: [...(prev.scrubConfirmed ?? [])],
      scrubPhase: prev.scrubPhase ?? 1,
      scrubClimbingId: prev.scrubClimbingId ?? null,
      scrubBlendGroup: prev.scrubBlendGroup ?? null,
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
  if (kind === "scrub") {
    return {
      eyebrow: "Build · same losses",
      prompt:
        "Same number of losses — keep the higher team or swap in your preference.",
    };
  }
  if (kind === "blend") {
    return {
      eyebrow: "Build · blend groups",
      prompt:
        "Fewer losses is currently higher. Promote the lower team to climb, or keep this order and return to the next seam.",
    };
  }
  return {
    eyebrow: "Build · place on the ballot",
    prompt: "Who belongs higher? Your pick narrows where the unplaced team sits.",
  };
}
