import { shortCbbConference } from "./cbb-conferences";
import {
  overallAverage,
  predictiveAverage,
  resumeAverage,
  winPct,
} from "./cbb-metrics";
import { formatCbbDate } from "./cbb-season";
import {
  FIELD_SIZE,
  FIRST_FOUR_OUT,
  LOCK_SIZE,
  NEXT_FOUR_OUT,
  PLAY_IN_AT_LARGE_TEAMS,
  PLAY_IN_SEED_LINE_SIZE,
  PLAY_IN_16_TEAMS,
  RECOMMEND_WITHIN,
} from "./cbb-season";
import type {
  CbbFieldTeam,
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
 * 76-team field from an S-curve. At-larges stop once remaining slots
 * equal remaining conferences so every league still gets an auto-bid.
 */
export function assignField(
  sCurve: string[],
  teamsById: Map<string, CbbTeam>,
  allConferences: string[],
  bestByConference: Map<string, string>,
  fieldSize = FIELD_SIZE,
): FieldAssignment {
  const unrepresented = new Set(allConferences);
  const fieldIds: string[] = [];
  const roles = new Map<string, CbbFieldTeam["role"]>();
  const atLargeIds: string[] = [];
  const autoBidByConference: Record<string, string> = {};
  const placed = new Set<string>();

  const place = (teamId: string, role: CbbFieldTeam["role"]) => {
    if (placed.has(teamId) || fieldIds.length >= fieldSize) return;
    const team = teamsById.get(teamId);
    if (!team) return;
    fieldIds.push(teamId);
    placed.add(teamId);
    roles.set(teamId, role);
    if (role === "at-large") atLargeIds.push(teamId);
    else {
      autoBidByConference[team.conference] = teamId;
      unrepresented.delete(team.conference);
    }
  };

  for (const teamId of sCurve) {
    if (fieldIds.length >= fieldSize) break;
    const team = teamsById.get(teamId);
    if (!team || placed.has(teamId)) continue;
    const alreadyIn = !unrepresented.has(team.conference);
    const slotsLeft = fieldSize - fieldIds.length;
    const confsLeft = unrepresented.size;

    if (alreadyIn) {
      if (slotsLeft <= confsLeft) continue;
      place(teamId, "at-large");
      continue;
    }
    place(teamId, "auto-bid");
  }

  for (const conference of [...unrepresented]) {
    if (fieldIds.length >= fieldSize) break;
    const teamId = bestByConference.get(conference);
    if (!teamId || placed.has(teamId)) continue;
    place(teamId, "auto-bid");
  }

  const leftovers = sCurve.filter((id) => !placed.has(id) && teamsById.has(id));
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

/** 1–10 and 12–15 have four teams; 11-seeds and 16-seeds hold two byes plus eight play-in teams. */
export function seedLineSize(seed: number): number {
  return seed === 11 || seed === 16 ? PLAY_IN_SEED_LINE_SIZE : 4;
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

/**
 * Four 16-seed play-in games (eight teams on that line) plus four games
 * among the lowest at-large bids that are not already on the 16-line.
 */
export function markPlayIn(field: CbbFieldTeam[]): CbbFieldTeam[] {
  const playInIds = new Set<string>();
  const sixteen = field.filter((row) => row.seed === 16);
  for (const row of sixteen.slice(-PLAY_IN_16_TEAMS)) playInIds.add(row.teamId);
  const atLarge = field.filter(
    (row) => row.role === "at-large" && row.seed !== 16 && !playInIds.has(row.teamId),
  );
  for (const row of atLarge.slice(-PLAY_IN_AT_LARGE_TEAMS)) playInIds.add(row.teamId);
  return field.map((row) => ({ ...row, playIn: playInIds.has(row.teamId) }));
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
  const playInByes = seedLineSize(seed) - (seed === 16 ? PLAY_IN_16_TEAMS : seed === 11 ? PLAY_IN_AT_LARGE_TEAMS : 0);
  return {
    rank,
    seed,
    playIn: playInByes < seedLineSize(seed) && offset >= playInByes,
    band,
  };
}

export function spotLabel(spot: CbbTeamSpot): string {
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
    return { rank: rank || row.sCurveIndex + 1, seed: row.seed, playIn: row.playIn, band: "field" };
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

export function previousConsideredIds(snapshot: CbbSnapshot | null): Set<string> {
  if (!snapshot) return new Set();
  return new Set([
    ...snapshot.atLargeIds,
    ...Object.values(snapshot.autoBidByConference),
    ...snapshot.firstFourOut,
    ...snapshot.nextFourOut,
  ]);
}

export function recommendNewTeams(
  teams: CbbTeam[],
  metrics: Map<string, CbbTeamMetrics>,
  previous: CbbSnapshot | null,
  within = RECOMMEND_WITHIN,
): string[] {
  if (!previous?.nextFourOut.length) return [];
  const considered = previousConsideredIds(previous);
  const bottomId = previous.nextFourOut[previous.nextFourOut.length - 1];
  const bottom = metrics.get(bottomId ?? "");
  const bottomOverall = overallAverage(bottom);
  const bottomResume = resumeAverage(bottom);
  const bottomPred = predictiveAverage(bottom);
  if (!bottomId || (bottomOverall == null && bottomResume == null && bottomPred == null)) return [];
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const withinCutoff = (value: number | null, floor: number | null) =>
    value != null && floor != null && value <= floor + within;
  return sortByMetrics(
    teams
      .filter((team) => !considered.has(team.id))
      .filter((team) => {
        const row = metrics.get(team.id);
        return (
          withinCutoff(overallAverage(row), bottomOverall) ||
          withinCutoff(resumeAverage(row), bottomResume) ||
          withinCutoff(predictiveAverage(row), bottomPred)
        );
      })
      .map((team) => team.id),
    teamsById,
    metrics,
  );
}

/** Last projection order (or live six-rank averages), plus missing auto-bid leaders. */
export function seedWorkingPool(
  teams: CbbTeam[],
  metrics: Map<string, CbbTeamMetrics>,
  previous: CbbSnapshot | null,
): string[] {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const liveIds = new Set(teams.map((team) => team.id));
  const bestByConf = bestTeamByConference(teams, teamsById, metrics);

  const injectAutoBids = (pool: string[]) => {
    const next = [...pool];
    const have = new Set(next);
    for (const id of bestByConf.values()) {
      if (!id || have.has(id) || !liveIds.has(id)) continue;
      for (let i = next.length - 1; i >= 0; i--) {
        const occupant = teamsById.get(next[i]!);
        if (!occupant) continue;
        const confAlready = next.some(
          (other, j) => j !== i && teamsById.get(other)?.conference === occupant.conference,
        );
        if (!confAlready) continue;
        have.delete(next[i]!);
        next.splice(i, 1);
        break;
      }
      next.push(id);
      have.add(id);
    }
    return next;
  };

  if (!previous) {
    const sorted = sortByMetrics(
      teams.map((team) => team.id),
      teamsById,
      metrics,
    );
    return injectAutoBids(sorted.slice(0, LOCK_SIZE));
  }

  const order = previous.sCurve.filter((id) => liveIds.has(id));
  return injectAutoBids(order.slice(0, LOCK_SIZE));
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
