import { FCS_SOS_RANK } from "./season";
import {
  applyWinnerAboveLoser,
  compareRecords,
  rankMapFromOrder,
  recordFromGames,
} from "./ranking-logic";
import type { Game, Team } from "./types";

export type ResultsBallotResult = {
  rankedIds: string[];
  /** Direct H2H conflicts repaired in the final pass */
  h2hRepairs: number;
  /** Remaining direct H2H violations (usually cycles / opinion gaps) */
  remainingH2hConflicts: number;
  /** Two-way transitive pairs (A chain-beats B and B chain-beats A) */
  cyclePairs: Array<{ a: string; b: string }>;
};

type WinGraph = {
  direct: Map<string, Set<string>>;
  transitive: Map<string, Set<string>>;
};

function emptySetMap(ids: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const id of ids) map.set(id, new Set());
  return map;
}

/** winnerId -> set of loserIds for final FBS-vs-FBS games */
export function buildDirectWinGraph(teamIds: string[], games: Game[]): Map<string, Set<string>> {
  const direct = emptySetMap(teamIds);
  const idSet = new Set(teamIds);

  for (const game of games) {
    if (game.status !== "final") continue;
    if (!game.homeIsFbs || !game.awayIsFbs) continue;
    if (game.homeScore == null || game.awayScore == null) continue;
    if (!idSet.has(game.homeTeamId) || !idSet.has(game.awayTeamId)) continue;

    let winnerId: string | null = null;
    let loserId: string | null = null;
    if (game.homeScore > game.awayScore) {
      winnerId = game.homeTeamId;
      loserId = game.awayTeamId;
    } else if (game.awayScore > game.homeScore) {
      winnerId = game.awayTeamId;
      loserId = game.homeTeamId;
    }
    if (!winnerId || !loserId || winnerId === loserId) continue;
    direct.get(winnerId)!.add(loserId);
  }

  return direct;
}

export function buildTransitiveWins(
  teamIds: string[],
  direct: Map<string, Set<string>>,
): Map<string, Set<string>> {
  const transitive = emptySetMap(teamIds);

  for (const id of teamIds) {
    const seen = new Set<string>();
    const queue = [...(direct.get(id) ?? [])];
    for (const q of queue) seen.add(q);

    let i = 0;
    while (i < queue.length) {
      const cur = queue[i++];
      for (const next of direct.get(cur) ?? []) {
        if (next === id || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    transitive.set(id, seen);
  }

  return transitive;
}

function buildWinGraph(teamIds: string[], games: Game[]): WinGraph {
  const direct = buildDirectWinGraph(teamIds, games);
  const transitive = buildTransitiveWins(teamIds, direct);
  return { direct, transitive };
}

function opponentRankValue(
  opponentId: string | null,
  opponentIsFbs: boolean,
  ranks: Map<string, number>,
): number {
  if (!opponentIsFbs) return FCS_SOS_RANK;
  if (!opponentId) return FCS_SOS_RANK;
  return ranks.get(opponentId) ?? FCS_SOS_RANK;
}

function teamResultMetrics(
  teamId: string,
  games: Game[],
  ranks: Map<string, number>,
): { qualityWins: number; playedSos: number | null; played: number } {
  let qualityWins = 0;
  let sosSum = 0;
  let played = 0;

  for (const game of games) {
    if (game.status !== "final") continue;
    const isHome = game.homeTeamId === teamId;
    const isAway = game.awayTeamId === teamId;
    if (!isHome && !isAway) continue;
    if (game.homeScore == null || game.awayScore == null) continue;

    const teamScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;
    const oppId = isHome ? game.awayTeamId : game.homeTeamId;
    const oppIsFbs = isHome ? game.awayIsFbs : game.homeIsFbs;
    const oppRank = opponentRankValue(oppId, oppIsFbs, ranks);

    played += 1;
    sosSum += oppRank;
    if (teamScore > oppScore) {
      qualityWins += FCS_SOS_RANK + 1 - oppRank;
    }
  }

  return {
    qualityWins,
    playedSos: played > 0 ? sosSum / played : null,
    played,
  };
}

function seedOrder(teamIds: string[], preserveOrder: string[]): string[] {
  const preserveIndex = new Map(preserveOrder.map((id, index) => [id, index]));
  const inPreserve = teamIds.filter((id) => preserveIndex.has(id));
  const missing = teamIds.filter((id) => !preserveIndex.has(id));
  inPreserve.sort((a, b) => (preserveIndex.get(a) ?? 0) - (preserveIndex.get(b) ?? 0));
  missing.sort((a, b) => a.localeCompare(b));
  return [...inPreserve, ...missing];
}

function countDirectH2hConflicts(
  rankedIds: string[],
  direct: Map<string, Set<string>>,
): number {
  const ranks = rankMapFromOrder(rankedIds);
  let count = 0;
  for (const [winnerId, losers] of direct) {
    const winnerRank = ranks.get(winnerId);
    if (winnerRank == null) continue;
    for (const loserId of losers) {
      const loserRank = ranks.get(loserId);
      if (loserRank != null && loserRank < winnerRank) count += 1;
    }
  }
  return count;
}

/** Greedily put each direct winner above their loser until stable. */
export function repairDirectH2hConflicts(
  rankedIds: string[],
  games: Game[],
  maxPasses = 60,
): { rankedIds: string[]; repairs: number } {
  const direct = buildDirectWinGraph(rankedIds, games);
  let order = [...rankedIds];
  let repairs = 0;

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;

    for (const [winnerId, losers] of direct) {
      for (const loserId of losers) {
        const winnerIdx = order.indexOf(winnerId);
        const loserIdx = order.indexOf(loserId);
        if (winnerIdx < 0 || loserIdx < 0 || winnerIdx < loserIdx) continue;
        const next = applyWinnerAboveLoser(order, winnerId, loserId);
        if (next.some((id, i) => id !== order[i])) {
          order = next;
          repairs += 1;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return { rankedIds: order, repairs };
}

export function findCyclePairs(
  teamIds: string[],
  transitive: Map<string, Set<string>>,
): Array<{ a: string; b: string }> {
  const pairs: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < teamIds.length; i++) {
    const a = teamIds[i];
    for (let j = i + 1; j < teamIds.length; j++) {
      const b = teamIds[j];
      if (transitive.get(a)?.has(b) && transitive.get(b)?.has(a)) {
        pairs.push({ a, b });
      }
    }
  }
  return pairs;
}

/**
 * Results-first ballot:
 * record → direct H2H → one-way transitive wins → quality wins / SOS → preserve prior order.
 * Then repair remaining direct H2H violations where possible.
 */
export function buildResultsBallot(
  teamIds: string[],
  games: Game[],
  options?: {
    preserveOrder?: string[];
    teamsById?: Map<string, Team>;
  },
): ResultsBallotResult {
  const preserveOrder = options?.preserveOrder ?? [];
  const graph = buildWinGraph(teamIds, games);
  const records = new Map(
    teamIds.map((id) => [id, recordFromGames(id, games)] as const),
  );
  const preserveIndex = new Map(preserveOrder.map((id, index) => [id, index]));

  let order = seedOrder(teamIds, preserveOrder);

  const compareWithRanks = (a: string, b: string, ranks: Map<string, number>): number => {
    const rec = compareRecords(
      records.get(a) ?? { wins: 0, losses: 0 },
      records.get(b) ?? { wins: 0, losses: 0 },
    );
    if (rec !== 0) return rec;

    if (graph.direct.get(a)?.has(b)) return -1;
    if (graph.direct.get(b)?.has(a)) return 1;

    const aOverB = graph.transitive.get(a)?.has(b) ?? false;
    const bOverA = graph.transitive.get(b)?.has(a) ?? false;
    if (aOverB && !bOverA) return -1;
    if (bOverA && !aOverB) return 1;

    const metricsA = teamResultMetrics(a, games, ranks);
    const metricsB = teamResultMetrics(b, games, ranks);
    if (metricsA.qualityWins !== metricsB.qualityWins) {
      return metricsB.qualityWins - metricsA.qualityWins;
    }
    if (metricsA.playedSos != null && metricsB.playedSos != null) {
      if (metricsA.playedSos !== metricsB.playedSos) {
        return metricsA.playedSos - metricsB.playedSos;
      }
    } else if (metricsA.playedSos != null) {
      return -1;
    } else if (metricsB.playedSos != null) {
      return 1;
    }

    const pa = preserveIndex.has(a) ? preserveIndex.get(a)! : Number.MAX_SAFE_INTEGER;
    const pb = preserveIndex.has(b) ? preserveIndex.get(b)! : Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;

    const nameA = options?.teamsById?.get(a)?.name ?? a;
    const nameB = options?.teamsById?.get(b)?.name ?? b;
    return nameA.localeCompare(nameB);
  };

  // Iterate so quality wins / SOS settle using provisional ranks
  for (let round = 0; round < 10; round++) {
    const ranks = rankMapFromOrder(order);
    const next = [...teamIds].sort((a, b) => compareWithRanks(a, b, ranks));
    const same = next.every((id, index) => id === order[index]);
    order = next;
    if (same) break;
  }

  const repaired = repairDirectH2hConflicts(order, games);
  order = repaired.rankedIds;

  const remainingH2hConflicts = countDirectH2hConflicts(order, graph.direct);
  const cyclePairs = findCyclePairs(teamIds, graph.transitive).slice(0, 40);

  return {
    rankedIds: order,
    h2hRepairs: repaired.repairs,
    remainingH2hConflicts,
    cyclePairs,
  };
}

/** Apply each unique winner/loser repair (conflict queue “fix all”). */
export function fixAllDirectH2h(
  rankedIds: string[],
  games: Game[],
): { rankedIds: string[]; repairs: number } {
  return repairDirectH2hConflicts(rankedIds, games);
}
