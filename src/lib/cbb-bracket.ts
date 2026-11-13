import { isAutoBidConference, shortCbbConference } from "./cbb-conferences";
import {
  overallAverage,
  predictiveAverage,
  resumeAverage,
  winPct,
} from "./cbb-metrics";
import { formatCbbDate } from "./cbb-season";
import {
  COMPLETED_ABOVE,
  FIELD_SIZE,
  FIRST_FOUR_OUT,
  LAST_FOUR_IN,
  LOCK_SIZE,
  NEXT_FOUR_OUT,
  PLAY_IN_TEAMS,
  SEED_LINE_PLAY_IN_GAMES,
  SEED_LINE_SPOTS,
  RECOMMEND_WITHIN,
} from "./cbb-season";
import type {
  CbbFieldResult,
  CbbFieldTeam,
  CbbPlayedGame,
  CbbScrubBand,
  CbbSnapshot,
  CbbTeam,
  CbbTeamMetrics,
  CbbTeamSpot,
} from "./cbb-types";

export type FieldAssignment = {
  field: CbbFieldTeam[];
  atLargeIds: string[];
  autoBidByConference: Record<string, string>;
  firstFourOut: string[];
  nextFourOut: string[];
  unrepresented: string[];
};

function metricsOf(
  teamId: string,
  metrics: Map<string, CbbTeamMetrics>,
): CbbTeamMetrics | undefined {
  return metrics.get(teamId);
}

export function compareCbbTeams(
  leftId: string,
  rightId: string,
  teamsById: Map<string, CbbTeam>,
  metrics: Map<string, CbbTeamMetrics>,
): number {
  const leftMetrics = metricsOf(leftId, metrics);
  const rightMetrics = metricsOf(rightId, metrics);
  const overall = (overallAverage(leftMetrics) ?? 9999) - (overallAverage(rightMetrics) ?? 9999);
  if (overall !== 0) return overall;
  const resume = (resumeAverage(leftMetrics) ?? 9999) - (resumeAverage(rightMetrics) ?? 9999);
  if (resume !== 0) return resume;
  const pred = (predictiveAverage(leftMetrics) ?? 9999) - (predictiveAverage(rightMetrics) ?? 9999);
  if (pred !== 0) return pred;
  const left = teamsById.get(leftId);
  const right = teamsById.get(rightId);
  const pct = winPct(right ?? { wins: 0, losses: 0 }) - winPct(left ?? { wins: 0, losses: 0 });
  if (pct !== 0) return pct;
  const leftLosses = left?.losses ?? 0;
  const rightLosses = right?.losses ?? 0;
  if (leftLosses !== rightLosses) return leftLosses - rightLosses;
  const leftWins = left?.wins ?? 0;
  const rightWins = right?.wins ?? 0;
  if (leftWins !== rightWins) return rightWins - leftWins;
  return (left?.name ?? leftId).localeCompare(right?.name ?? rightId);
}

export function sortByMetrics(
  teamIds: string[],
  teamsById: Map<string, CbbTeam>,
  metrics: Map<string, CbbTeamMetrics>,
): string[] {
  return [...teamIds].sort((left, right) => compareCbbTeams(left, right, teamsById, metrics));
}

export function conferencesFromTeams(teams: CbbTeam[]): string[] {
  return [...new Set(teams.map((team) => team.conference))].sort((a, b) =>
    shortCbbConference(a).localeCompare(shortCbbConference(b)),
  );
}

export function autoBidConferences(teams: CbbTeam[], listed?: string[]): string[] {
  if (listed?.length) return listed.filter(isAutoBidConference);
  return conferencesFromTeams(teams).filter(isAutoBidConference);
}

/** Auto-bids who only fill reserved 12–16 slots, not the at-large board. */
export const AUTO_BID_SCRUB_SEED = 12;

export function bestTeamByConference(
  teams: CbbTeam[],
  teamsById: Map<string, CbbTeam>,
  metrics: Map<string, CbbTeamMetrics>,
): Map<string, string> {
  const grouped = new Map<string, string[]>();
  for (const team of teams) {
    const list = grouped.get(team.conference) ?? [];
    list.push(team.id);
    grouped.set(team.conference, list);
  }
  const best = new Map<string, string>();
  for (const [conference, ids] of grouped) {
    const sorted = sortByMetrics(ids, teamsById, metrics);
    const top = sorted[0];
    if (top) best.set(conference, top);
  }
  return best;
}

/**
 * 76-team field from an S-curve. Auto-bids are always the conference
 * leaders (bestByConference), never a higher-ranked teammate, and they
 * always occupy a field slot. At-larges stop once remaining slots equal
 * remaining auto-bids so First/Next 4 Out never include a bid-holder.
 */
export function assignField(
  sCurve: string[],
  teamsById: Map<string, CbbTeam>,
  allConferences: string[],
  bestByConference: Map<string, string>,
  fieldSize = FIELD_SIZE,
): FieldAssignment {
  const unrepresented = new Set(allConferences);
  const autoBidIds = new Set<string>();
  for (const conference of allConferences) {
    const id = bestByConference.get(conference);
    if (id) autoBidIds.add(id);
  }
  const fieldIds: string[] = [];
  const roles = new Map<string, CbbFieldTeam["role"]>();
  const atLargeIds: string[] = [];
  const autoBidByConference: Record<string, string> = {};
  const placed = new Set<string>();

  const place = (teamId: string, role: CbbFieldTeam["role"]) => {
    if (placed.has(teamId) || fieldIds.length >= fieldSize) return false;
    const team = teamsById.get(teamId);
    if (!team) return false;
    fieldIds.push(teamId);
    placed.add(teamId);
    roles.set(teamId, role);
    if (role === "at-large") atLargeIds.push(teamId);
    else {
      autoBidByConference[team.conference] = teamId;
      unrepresented.delete(team.conference);
    }
    return true;
  };

  const evictLastAtLarge = () => {
    for (let i = fieldIds.length - 1; i >= 0; i--) {
      const id = fieldIds[i]!;
      if (roles.get(id) !== "at-large") continue;
      fieldIds.splice(i, 1);
      placed.delete(id);
      roles.delete(id);
      const at = atLargeIds.indexOf(id);
      if (at >= 0) atLargeIds.splice(at, 1);
      return true;
    }
    return false;
  };

  for (const teamId of sCurve) {
    const team = teamsById.get(teamId);
    if (!team || placed.has(teamId)) continue;
    const slotsLeft = fieldSize - fieldIds.length;
    const confsLeft = unrepresented.size;

    if (autoBidIds.has(teamId)) {
      if (fieldIds.length >= fieldSize) evictLastAtLarge();
      place(teamId, "auto-bid");
      continue;
    }
    if (fieldIds.length >= fieldSize || slotsLeft <= confsLeft) continue;
    place(teamId, "at-large");
  }

  for (const conference of [...unrepresented]) {
    const teamId = bestByConference.get(conference);
    if (!teamId || placed.has(teamId)) continue;
    if (fieldIds.length >= fieldSize) evictLastAtLarge();
    place(teamId, "auto-bid");
  }

  const leftovers = sCurve.filter((id) => !placed.has(id) && teamsById.has(id) && !autoBidIds.has(id));
  const field: CbbFieldTeam[] = markPlayIn(
    fieldIds.map((teamId, index) => ({
      teamId,
      role: roles.get(teamId) ?? "at-large",
      sCurveIndex: index,
      seed: seedForFieldIndex(index),
      playIn: false,
    })),
  );

  return {
    field,
    atLargeIds,
    autoBidByConference,
    firstFourOut: leftovers.slice(0, FIRST_FOUR_OUT),
    nextFourOut: leftovers.slice(FIRST_FOUR_OUT, FIRST_FOUR_OUT + NEXT_FOUR_OUT),
    unrepresented: [...unrepresented],
  };
}

/** Opening Round games on this seed line (0 if every team already has a First Round bye). */
export function seedLinePlayInGames(seed: number): number {
  return SEED_LINE_PLAY_IN_GAMES[seed] ?? 0;
}

/** Play-in names on this line; always even so they pair for one First Round spot. */
export function seedLinePlayInTeams(seed: number): number {
  return seedLinePlayInGames(seed) * 2;
}

/** Listed names on a seed line: four First Round spots plus one extra team per play-in game. */
export function seedLineSize(seed: number): number {
  return SEED_LINE_SPOTS + seedLinePlayInGames(seed);
}

export function seedForFieldIndex(index: number): number {
  let cursor = 0;
  for (let seed = 1; seed <= 16; seed++) {
    const size = seedLineSize(seed);
    if (index < cursor + size) return seed;
    cursor += size;
  }
  return 16;
}

export function firstIndexForSeed(seed: number): number {
  let cursor = 0;
  for (let current = 1; current < seed; current++) cursor += seedLineSize(current);
  return cursor;
}

/** Auto-bids only play in the Opening Round on the 15- and 16-seed lines. */
export function autoBidPlayInSeed(seed: number): boolean {
  return seed === 15 || seed === 16;
}

function evenCount(n: number): number {
  return n - (n % 2);
}

function worseFirst(left: CbbFieldTeam, right: CbbFieldTeam): number {
  return right.sCurveIndex - left.sCurveIndex;
}

function betterFirst(left: CbbFieldTeam, right: CbbFieldTeam): number {
  return left.sCurveIndex - right.sCurveIndex;
}

/** 12 lowest at-larges play in the Opening Round. */
export function openingRoundAtLargeTeams(): number {
  return PLAY_IN_TEAMS / 2;
}

/** 12 lowest auto-bids play in on 15/16. */
export function openingRoundAutoBidTeams(): number {
  return PLAY_IN_TEAMS / 2;
}

const HALF_SPOTS = SEED_LINE_SPOTS * 2;
const PLAY_IN_COST = 1;
const BYE_COST = 2;

/**
 * Opening Round at-larges are the 12 lowest at-larges (no at-large bye is
 * ranked below a play-in at-large). Auto-bids play in only on 15/16; an
 * auto-bid that lands on 11–14 keeps a bye, and play-in at-larges slide to
 * 12 then 13 so every seed line still has four First Round spots
 * (`listed − play-in/2 = 4`). Rank order (`sCurveIndex`) is unchanged.
 */
export function markPlayIn(field: CbbFieldTeam[]): CbbFieldTeam[] {
  const next = field.map((row) => ({ ...row, playIn: false }));
  const atLarge = next.filter((row) => row.role === "at-large").sort(worseFirst);
  const autoBids = next.filter((row) => row.role === "auto-bid").sort(worseFirst);
  const alPlayInIds = new Set(
    atLarge
      .slice(0, evenCount(Math.min(openingRoundAtLargeTeams(), atLarge.length)))
      .map((row) => row.teamId),
  );
  const aqPlayInIds = new Set(
    autoBids
      .slice(0, evenCount(Math.min(openingRoundAutoBidTeams(), autoBids.length)))
      .map((row) => row.teamId),
  );
  const isPlayIn = (row: CbbFieldTeam) =>
    row.role === "at-large" ? alPlayInIds.has(row.teamId) : aqPlayInIds.has(row.teamId);
  const costOf = (row: CbbFieldTeam) => (isPlayIn(row) ? PLAY_IN_COST : BYE_COST);

  if (next.length !== FIELD_SIZE) {
    return next.map((row) => ({
      ...row,
      playIn: isPlayIn(row) && (row.role === "at-large" || autoBidPlayInSeed(row.seed)),
    }));
  }

  let seed = 1;
  let used = 0;
  const assigned = new Set<string>();
  const prepaid = new Map<number, number>();
  const deferred: CbbFieldTeam[] = [];
  const deferIds = new Set<string>();

  const openSeed = (nextSeed: number) => {
    seed = nextSeed;
    used = prepaid.get(seed) ?? 0;
    const remain: CbbFieldTeam[] = [];
    for (const row of deferred) {
      const cost = costOf(row);
      if (used + cost <= HALF_SPOTS) {
        row.seed = seed;
        row.playIn = isPlayIn(row);
        assigned.add(row.teamId);
        used += cost;
      } else {
        remain.push(row);
      }
    }
    deferred.length = 0;
    deferred.push(...remain);
  };

  const slideBestPlayInOnSeed = (): boolean => {
    const slide = next
      .filter((row) => assigned.has(row.teamId) && row.seed === seed && row.playIn && row.role === "at-large")
      .sort(betterFirst)[0];
    if (!slide) return false;
    slide.seed = seed + 1;
    prepaid.set(seed + 1, (prepaid.get(seed + 1) ?? 0) + costOf(slide));
    return true;
  };

  for (let i = 0; i < next.length; i++) {
    const row = next[i];
    if (deferIds.has(row.teamId)) {
      deferred.push(row);
      continue;
    }

    const cost = costOf(row);
    while (used + cost > HALF_SPOTS) {
      if (
        seed >= 11 &&
        cost === BYE_COST &&
        used === HALF_SPOTS - PLAY_IN_COST &&
        slideBestPlayInOnSeed()
      ) {
        used -= PLAY_IN_COST;
        continue;
      }
      openSeed(seed + 1);
    }

    if (seed >= 11 && seed <= 13 && row.role === "auto-bid" && cost === BYE_COST) {
      const leftoverAfter = HALF_SPOTS - (used + cost);
      const remainingPiAls: CbbFieldTeam[] = [];
      for (let j = i + 1; j < next.length; j++) {
        const later = next[j];
        if (later.role === "at-large" && alPlayInIds.has(later.teamId) && !deferIds.has(later.teamId)) {
          remainingPiAls.push(later);
        }
      }
      if (leftoverAfter === PLAY_IN_COST * 2 && remainingPiAls.length >= 4) {
        deferIds.add(remainingPiAls[0]!.teamId);
      }
    }

    row.seed = seed;
    row.playIn = isPlayIn(row);
    assigned.add(row.teamId);
    used += cost;
  }

  for (const row of deferred) {
    const cost = costOf(row);
    while (used + cost > HALF_SPOTS) openSeed(seed + 1);
    row.seed = seed;
    row.playIn = isPlayIn(row);
    assigned.add(row.teamId);
    used += cost;
  }

  return next.map((row) => ({
    ...row,
    playIn: row.role === "auto-bid" ? Boolean(row.playIn && autoBidPlayInSeed(row.seed)) : row.playIn,
  }));
}

export function bandForRank(rank: number): CbbScrubBand {
  if (rank < 1) return "out";
  if (rank <= FIELD_SIZE) return "field";
  if (rank <= FIELD_SIZE + FIRST_FOUR_OUT) return "first-four-out";
  if (rank <= LOCK_SIZE) return "next-four-out";
  return "out";
}

/** Seed and play-in slot from overall seed-list rank (1 is best). */
export function spotFromRank(rank: number): CbbTeamSpot {
  const band = bandForRank(rank);
  if (band !== "field") {
    return { rank, seed: null, playIn: false, band };
  }
  const index = rank - 1;
  const seed = seedForFieldIndex(index);
  const offset = index - firstIndexForSeed(seed);
  const byes = seedLineSize(seed) - seedLinePlayInTeams(seed);
  return {
    rank,
    seed,
    playIn: offset >= byes,
    band,
  };
}

export function lastFourInIds(assignment: FieldAssignment): Set<string> {
  return new Set(
    assignment.field
      .filter((row) => row.role === "at-large")
      .slice(-LAST_FOUR_IN)
      .map((row) => row.teamId),
  );
}

export function spotLabel(spot: CbbTeamSpot): string {
  if (spot.band === "last-four-in") return "Last 4 in";
  if (spot.band === "first-four-out") return "First 4 out";
  if (spot.band === "next-four-out") return "Next 4 out";
  if (spot.band === "out") return "Out";
  if (spot.seed == null) return `#${spot.rank}`;
  return spot.playIn ? `${spot.seed}-seed · Play-in` : `${spot.seed}-seed`;
}

export function spotForTeam(
  teamId: string,
  rankedIds: string[],
  assignment: FieldAssignment,
): CbbTeamSpot {
  const ranked = rankedIds.indexOf(teamId);
  const rank = ranked >= 0 ? ranked + 1 : 0;
  const row = assignment.field.find((item) => item.teamId === teamId);
  if (row) {
    const lastFour = lastFourInIds(assignment);
    return {
      rank: rank || row.sCurveIndex + 1,
      seed: row.seed,
      playIn: row.playIn,
      band: lastFour.has(teamId) ? "last-four-in" : "field",
    };
  }
  const firstOut = assignment.firstFourOut.indexOf(teamId);
  if (firstOut >= 0) {
    return { rank: rank || FIELD_SIZE + firstOut + 1, seed: null, playIn: false, band: "first-four-out" };
  }
  const nextOut = assignment.nextFourOut.indexOf(teamId);
  if (nextOut >= 0) {
    return {
      rank: rank || FIELD_SIZE + FIRST_FOUR_OUT + nextOut + 1,
      seed: null,
      playIn: false,
      band: "next-four-out",
    };
  }
  return spotFromRank(rank);
}

/** Seed-list teams immediately above the current pair, newest/closest last. */
export function teamsAboveCurrent(
  rankedIds: string[],
  leftRank: number,
  count = COMPLETED_ABOVE,
): string[] {
  const end = Math.max(0, leftRank - 1);
  const start = Math.max(0, end - count);
  return rankedIds.slice(start, end);
}

export function padAboveSlots(ids: string[], count = COMPLETED_ABOVE): Array<string | null> {
  const trimmed = ids.slice(-count);
  const pad = Math.max(0, count - trimmed.length);
  return [...Array.from({ length: pad }, () => null), ...trimmed];
}

/** Final results against opponents currently in the 76-team field. */
export function fieldResultsForTeam(
  teamId: string,
  games: CbbPlayedGame[],
  assignment: FieldAssignment,
): CbbFieldResult[] {
  const inField = new Map(assignment.field.map((row) => [row.teamId, row]));
  const byOpponent = new Map<string, CbbFieldResult>();
  for (const game of games) {
    if (game.status !== "final" || !game.winnerId) continue;
    const opponentId =
      game.homeTeamId === teamId ? game.awayTeamId : game.awayTeamId === teamId ? game.homeTeamId : null;
    if (!opponentId || opponentId === teamId) continue;
    const row = inField.get(opponentId);
    if (!row) continue;
    byOpponent.set(opponentId, {
      opponentId,
      result: game.winnerId === teamId ? "W" : "L",
      seed: row.seed,
      rank: row.sCurveIndex + 1,
      playIn: row.playIn,
    });
  }
  return [...byOpponent.values()].sort((left, right) => {
    if (left.result !== right.result) return left.result === "W" ? -1 : 1;
    return left.seed - right.seed || left.rank - right.rank;
  });
}

export function previousConsideredIds(snapshot: CbbSnapshot | null): Set<string> {
  if (!snapshot) return new Set();
  return new Set([...snapshot.atLargeIds, ...snapshot.firstFourOut, ...snapshot.nextFourOut]);
}

function withinRecommendCutoff(
  row: CbbTeamMetrics | undefined,
  bottomOverall: number | null,
  bottomResume: number | null,
  bottomPred: number | null,
  within: number,
): boolean {
  const close = (value: number | null, floor: number | null) =>
    value != null && floor != null && value <= floor + within;
  return (
    close(overallAverage(row), bottomOverall) ||
    close(resumeAverage(row), bottomResume) ||
    close(predictiveAverage(row), bottomPred)
  );
}

export function recommendNewTeams(
  teams: CbbTeam[],
  metrics: Map<string, CbbTeamMetrics>,
  previous: CbbSnapshot | null,
  within = RECOMMEND_WITHIN,
  alreadyOnBoard: Iterable<string> = [],
): string[] {
  if (!previous?.nextFourOut.length) return [];
  const considered = new Set([...previousConsideredIds(previous), ...alreadyOnBoard]);
  const bottomId = previous.nextFourOut[previous.nextFourOut.length - 1];
  const bottom = metrics.get(bottomId ?? "");
  const bottomOverall = overallAverage(bottom);
  const bottomResume = resumeAverage(bottom);
  const bottomPred = predictiveAverage(bottom);
  if (!bottomId || (bottomOverall == null && bottomResume == null && bottomPred == null)) return [];
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  return sortByMetrics(
    teams
      .filter((team) => !considered.has(team.id))
      .filter((team) =>
        withinRecommendCutoff(metrics.get(team.id), bottomOverall, bottomResume, bottomPred, within),
      )
      .map((team) => team.id),
    teamsById,
    metrics,
  );
}

function firstAtLargeBoardIds(
  teams: CbbTeam[],
  teamsById: Map<string, CbbTeam>,
  metrics: Map<string, CbbTeamMetrics>,
  allConferences: string[],
): string[] {
  const bestByConf = bestTeamByConference(teams, teamsById, metrics);
  const autoBidIds = new Set<string>();
  for (const conference of allConferences) {
    const id = bestByConf.get(conference);
    if (id) autoBidIds.add(id);
  }
  const sorted = sortByMetrics(
    teams.map((team) => team.id),
    teamsById,
    metrics,
  );
  const unrepresented = new Set(allConferences);
  const board: string[] = [];
  let fieldCount = 0;
  let outCount = 0;
  const outLimit = FIRST_FOUR_OUT + NEXT_FOUR_OUT;

  for (const teamId of sorted) {
    const team = teamsById.get(teamId);
    if (!team) continue;
    const slotsLeft = FIELD_SIZE - fieldCount;
    const confsLeft = unrepresented.size;
    const isLeader = autoBidIds.has(teamId);

    if (isLeader) {
      if (slotsLeft > confsLeft) {
        board.push(teamId);
        fieldCount += 1;
        unrepresented.delete(team.conference);
      }
      continue;
    }

    if (slotsLeft > confsLeft) {
      board.push(teamId);
      fieldCount += 1;
    } else if (outCount < outLimit) {
      board.push(teamId);
      outCount += 1;
    }
  }
  return board;
}

/** At-large quality teams from the last projection, in that S-curve order. */
export function previousAtLargeBoardIds(
  previous: CbbSnapshot,
  teams: CbbTeam[],
  teamsById: Map<string, CbbTeam>,
  metrics: Map<string, CbbTeamMetrics>,
  allConferences: string[],
): string[] {
  const liveIds = new Set(teams.map((team) => team.id));
  const bestByConf = bestTeamByConference(teams, teamsById, metrics);
  const assignment = assignField(previous.sCurve, teamsById, allConferences, bestByConf);
  const onCurve = new Set(previous.sCurve);
  const board = new Set<string>();
  for (const id of [...previous.atLargeIds, ...previous.firstFourOut, ...previous.nextFourOut]) {
    if (liveIds.has(id)) board.add(id);
  }
  for (const row of assignment.field) {
    if (!liveIds.has(row.teamId)) continue;
    if (row.role === "at-large") board.add(row.teamId);
    else if (row.seed < AUTO_BID_SCRUB_SEED && onCurve.has(row.teamId)) board.add(row.teamId);
  }
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of previous.sCurve) {
    if (!board.has(id) || seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }
  for (const id of board) {
    if (seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }
  return ordered;
}

/**
 * At-large working pool only. Conference champs who cannot make it as
 * at-larges wait for the auto-bid pass.
 */
export function seedWorkingPool(
  teams: CbbTeam[],
  metrics: Map<string, CbbTeamMetrics>,
  previous: CbbSnapshot | null,
  listedConferences?: string[],
): string[] {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const allConferences = autoBidConferences(teams, listedConferences);
  if (!previous) return firstAtLargeBoardIds(teams, teamsById, metrics, allConferences);
  return previousAtLargeBoardIds(previous, teams, teamsById, metrics, allConferences);
}

/** Conference leaders not already on the at-large board, for the 12–16 scrub. */
export function remainingAutoBidIds(
  atLargeBoard: string[],
  teams: CbbTeam[],
  metrics: Map<string, CbbTeamMetrics>,
  listedConferences?: string[],
  previous: CbbSnapshot | null = null,
): string[] {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const have = new Set(atLargeBoard);
  const bestByConf = bestTeamByConference(teams, teamsById, metrics);
  const ids: string[] = [];
  for (const conference of autoBidConferences(teams, listedConferences)) {
    const id = bestByConf.get(conference);
    if (id && !have.has(id)) ids.push(id);
  }
  if (!previous) return sortByMetrics(ids, teamsById, metrics);
  const previousOrder = new Map(previous.sCurve.map((id, index) => [id, index]));
  return [...ids].sort((left, right) => {
    const leftPrev = previousOrder.get(left);
    const rightPrev = previousOrder.get(right);
    if (leftPrev != null && rightPrev != null) return leftPrev - rightPrev;
    if (leftPrev != null) return -1;
    if (rightPrev != null) return 1;
    return compareCbbTeams(left, right, teamsById, metrics);
  });
}

export function draftSCurve(rankedIds: string[], autoBidIds: string[] = []): string[] {
  const have = new Set(rankedIds);
  return [...rankedIds, ...autoBidIds.filter((id) => !have.has(id))];
}

export function snapshotFromAssignment(
  assignment: FieldAssignment,
  sCurve: string[],
  recommendedIds: string[],
  now = new Date(),
): CbbSnapshot {
  return {
    id: `cbb-${now.getTime()}`,
    createdAt: now.toISOString(),
    label: formatCbbDate(now.toISOString(), now),
    sCurve: [...sCurve],
    atLargeIds: [...assignment.atLargeIds],
    autoBidByConference: { ...assignment.autoBidByConference },
    firstFourOut: [...assignment.firstFourOut],
    nextFourOut: [...assignment.nextFourOut],
    recommendedIds: [...recommendedIds],
  };
}

export function liveFieldPreview(
  rankedIds: string[],
  teamsById: Map<string, CbbTeam>,
  allConferences: string[],
): { atLarge: number; autoBids: number; conferencesIn: number; reserved: number } {
  const unrepresented = new Set(allConferences);
  let atLarge = 0;
  let autoBids = 0;
  let placed = 0;
  for (const teamId of rankedIds) {
    if (placed >= FIELD_SIZE) break;
    const team = teamsById.get(teamId);
    if (!team) continue;
    const alreadyIn = !unrepresented.has(team.conference);
    const slotsLeft = FIELD_SIZE - placed;
    const confsLeft = unrepresented.size;
    if (alreadyIn) {
      if (slotsLeft <= confsLeft) continue;
      atLarge += 1;
      placed += 1;
      continue;
    }
    autoBids += 1;
    placed += 1;
    unrepresented.delete(team.conference);
  }
  return {
    atLarge,
    autoBids,
    conferencesIn: allConferences.length - unrepresented.size,
    reserved: unrepresented.size,
  };
}
