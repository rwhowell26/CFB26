import { compareRecords, getTeam, REGIONS, TEAMS } from "./teams";
import type { Assignment, RegionId, Team, TierId } from "./types";

export function teamsIn(
  assignment: Assignment,
  region: RegionId,
  tier?: TierId,
): Team[] {
  return TEAMS.filter((team) => {
    const place = assignment[team.id];
    if (!place || place.region !== region) return false;
    return tier === undefined || place.tier === tier;
  }).sort(compareRecords);
}

export function rankTeams(teams: Team[]): Team[] {
  return [...teams].sort(compareRecords);
}

export function regionRanks(assignment: Assignment): Record<RegionId, Team[]> {
  const ranks = {} as Record<RegionId, Team[]>;
  for (const region of REGIONS) {
    ranks[region.id] = teamsIn(assignment, region.id);
  }
  return ranks;
}

export function standingIndex(assignment: Assignment, teamId: string): number {
  const place = assignment[teamId];
  const ranked = teamsIn(assignment, place.region);
  return ranked.findIndex((team) => team.id === teamId);
}

export function rivalTeams(teamId: string): Team[] {
  return getTeam(teamId).rivals.map(getTeam);
}
