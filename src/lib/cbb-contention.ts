import { sortByMetrics } from "./cbb-bracket";
import { overallAverage } from "./cbb-metrics";
import { CONTENTION_WITHIN } from "./cbb-season";
import type { CbbSnapshot, CbbTeam, CbbTeamMetrics } from "./cbb-types";

export type ContentionReason = "field" | "first-four-out" | "next-four-out" | "conference";

export type ContentionCandidate = {
  teamId: string;
  reasons: ContentionReason[];
  average: number | null;
  conferenceGap: number | null;
  conferenceLeaderId: string | null;
};

export type ContentionMove = {
  teamId: string;
  kind: "add" | "drop";
  reasons: ContentionReason[];
};

export function projectionContentionIds(snapshot: CbbSnapshot | null): {
  field: Set<string>;
  firstFourOut: Set<string>;
  nextFourOut: Set<string>;
  all: Set<string>;
} {
  const field = new Set<string>();
  const firstFourOut = new Set<string>();
  const nextFourOut = new Set<string>();
  if (!snapshot) return { field, firstFourOut, nextFourOut, all: new Set() };
  for (const id of snapshot.atLargeIds) field.add(id);
  for (const id of Object.values(snapshot.autoBidByConference)) field.add(id);
  for (const id of snapshot.firstFourOut) firstFourOut.add(id);
  for (const id of snapshot.nextFourOut) nextFourOut.add(id);
  return {
    field,
    firstFourOut,
    nextFourOut,
    all: new Set([...field, ...firstFourOut, ...nextFourOut]),
  };
}

export function conferenceLeaderAverages(
  teams: CbbTeam[],
  metrics: Map<string, CbbTeamMetrics>,
): Map<string, { teamId: string; average: number }> {
  const best = new Map<string, { teamId: string; average: number }>();
  for (const team of teams) {
    const average = overallAverage(metrics.get(team.id));
    if (average == null) continue;
    const current = best.get(team.conference);
    if (!current || average < current.average) {
      best.set(team.conference, { teamId: team.id, average });
    }
  }
  return best;
}

export function contentionCandidates(
  teams: CbbTeam[],
  metrics: Map<string, CbbTeamMetrics>,
  snapshot: CbbSnapshot | null,
  within = CONTENTION_WITHIN,
): ContentionCandidate[] {
  const projection = projectionContentionIds(snapshot);
  const leaders = conferenceLeaderAverages(teams, metrics);
  const byId = new Map<string, ContentionCandidate>();

  const upsert = (teamId: string, reason: ContentionReason, extra?: Partial<ContentionCandidate>) => {
    const existing = byId.get(teamId);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      if (extra?.conferenceGap != null) existing.conferenceGap = extra.conferenceGap;
      if (extra?.conferenceLeaderId) existing.conferenceLeaderId = extra.conferenceLeaderId;
      return;
    }
    byId.set(teamId, {
      teamId,
      reasons: [reason],
      average: overallAverage(metrics.get(teamId)),
      conferenceGap: extra?.conferenceGap ?? null,
      conferenceLeaderId: extra?.conferenceLeaderId ?? null,
    });
  };

  for (const id of projection.field) upsert(id, "field");
  for (const id of projection.firstFourOut) upsert(id, "first-four-out");
  for (const id of projection.nextFourOut) upsert(id, "next-four-out");

  for (const team of teams) {
    const average = overallAverage(metrics.get(team.id));
    const leader = leaders.get(team.conference);
    if (average == null || !leader) continue;
    const gap = average - leader.average;
    if (gap > within) continue;
    upsert(team.id, "conference", { conferenceGap: gap, conferenceLeaderId: leader.teamId });
  }

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const ids = sortByMetrics([...byId.keys()], teamsById, metrics);
  const reasonOrder: ContentionReason[] = ["field", "first-four-out", "next-four-out", "conference"];
  return ids.map((id) => {
    const row = byId.get(id)!;
    return {
      ...row,
      reasons: reasonOrder.filter((reason) => row.reasons.includes(reason)),
    };
  });
}

export function contentionMoves(
  candidates: Iterable<string>,
  approvedIds: string[] | null,
): ContentionMove[] {
  if (approvedIds == null) return [];
  const candidateSet = candidates instanceof Set ? candidates : new Set(candidates);
  const approved = new Set(approvedIds);
  const moves: ContentionMove[] = [];
  for (const id of candidateSet) {
    if (!approved.has(id)) moves.push({ teamId: id, kind: "add", reasons: [] });
  }
  for (const id of approvedIds) {
    if (!candidateSet.has(id)) moves.push({ teamId: id, kind: "drop", reasons: [] });
  }
  return moves;
}

export function withCandidateReasons(
  moves: ContentionMove[],
  candidates: ContentionCandidate[],
): ContentionMove[] {
  const byId = new Map(candidates.map((row) => [row.teamId, row.reasons]));
  return moves.map((move) => ({
    ...move,
    reasons: byId.get(move.teamId) ?? move.reasons,
  }));
}

export function applyContentionMove(approvedIds: string[], move: ContentionMove): string[] {
  if (move.kind === "add") {
    if (approvedIds.includes(move.teamId)) return approvedIds;
    return [...approvedIds, move.teamId];
  }
  return approvedIds.filter((id) => id !== move.teamId);
}

export function applyContentionMoves(approvedIds: string[], moves: ContentionMove[]): string[] {
  return moves.reduce(applyContentionMove, approvedIds);
}

export function contentionRosterIds(
  candidates: Iterable<string>,
  approvedIds: string[] | null,
): string[] {
  if (approvedIds == null) {
    return [...(candidates instanceof Set ? candidates : new Set(candidates))];
  }
  return [...approvedIds];
}
