import { shortCbbConference } from "./cbb-conferences";
import {
  overallAverage,
  predictiveAverage,
  resumeAverage,
  winPct,
} from "./cbb-metrics";
import { formatCbbTimestamp } from "./cbb-season";
import {
  FIELD_SIZE,
  FIRST_FOUR_OUT,
  NEXT_FOUR_OUT,
  RECOMMEND_WITHIN,
} from "./cbb-season";
import type {
  CbbFieldTeam,
  CbbSnapshot,
  CbbTeam,
  CbbTeamMetrics,
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
 * 68-team field from an S-curve. At-larges stop once remaining slots
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
  const field: CbbFieldTeam[] = fieldIds.map((teamId, index) => {
    const seedIndex = Math.min(index, 63);
    const seed = Math.min(16, Math.floor(seedIndex / 4) + 1);
    const role = roles.get(teamId) ?? "at-large";
    const playIn =
      (role === "auto-bid" && seed === 16 && index >= 60) ||
      (role === "at-large" && atLargeIds.indexOf(teamId) >= atLargeIds.length - 4);
    return { teamId, role, sCurveIndex: index, seed, playIn };
  });

  return {
    field,
    atLargeIds,
    autoBidByConference,
    firstFourOut: leftovers.slice(0, FIRST_FOUR_OUT),
    nextFourOut: leftovers.slice(FIRST_FOUR_OUT, FIRST_FOUR_OUT + NEXT_FOUR_OUT),
    unrepresented: [...unrepresented],
  };
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
  const bottomAvg = overallAverage(metrics.get(bottomId ?? ""));
  if (bottomAvg == null || !bottomId) return [];
  const cutoff = bottomAvg + within;
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  return sortByMetrics(
    teams
      .filter((team) => !considered.has(team.id))
      .filter((team) => {
        const avg = overallAverage(metrics.get(team.id));
        return avg != null && avg <= cutoff;
      })
      .map((team) => team.id),
    teamsById,
    metrics,
  );
}

/** Last projection order, plus recommended newcomers and missing auto-bid leaders. */
export function seedWorkingPool(
  teams: CbbTeam[],
  metrics: Map<string, CbbTeamMetrics>,
  previous: CbbSnapshot | null,
): string[] {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const liveIds = new Set(teams.map((team) => team.id));
  const bestByConf = bestTeamByConference(teams, teamsById, metrics);
  const extras: string[] = [];

  if (!previous) {
    const sorted = sortByMetrics(
      teams.map((team) => team.id),
      teamsById,
      metrics,
    );
    const top = sorted.slice(0, FIELD_SIZE + FIRST_FOUR_OUT + NEXT_FOUR_OUT);
    const have = new Set(top);
    for (const id of bestByConf.values()) {
      if (!have.has(id)) extras.push(id);
    }
    return [...top, ...extras];
  }

  const order = previous.sCurve.filter((id) => liveIds.has(id));
  const have = new Set(order);
  const add = (id: string) => {
    if (!liveIds.has(id) || have.has(id)) return;
    have.add(id);
    extras.push(id);
  };
  for (const id of recommendNewTeams(teams, metrics, previous)) add(id);
  for (const id of bestByConf.values()) add(id);
  return [...order, ...extras];
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
    label: formatCbbTimestamp(now.toISOString(), now),
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
