import { TEAMS } from "./teams";
import type { Assignment, RecordMap, RegionId, Team, TierId } from "./types";
import { compareRecords, withRecord } from "./teams";

export function teamsIn(
  assignment: Assignment,
  region: RegionId,
  tier?: TierId,
  records?: RecordMap,
): Team[] {
  return TEAMS.filter((team) => {
    const place = assignment[team.id];
    if (!place || place.region !== region) return false;
    return tier === undefined || place.tier === tier;
  })
    .map((team) => withRecord(team, records))
    .sort(compareRecords);
}

export function tiersInRegion(assignment: Assignment, region: RegionId): number[] {
  const tiers = new Set<number>();
  for (const team of TEAMS) {
    const place = assignment[team.id];
    if (place?.region === region) tiers.add(place.tier);
  }
  return [...tiers].sort((a, b) => a - b);
}

export function nextEmptyTier(assignment: Assignment, region: RegionId): number {
  const tiers = tiersInRegion(assignment, region);
  return (tiers[tiers.length - 1] ?? 0) + 1;
}

export function regionRanks(assignment: Assignment, records?: RecordMap): Record<RegionId, Team[]> {
  return {
    east: teamsIn(assignment, "east", undefined, records),
    south: teamsIn(assignment, "south", undefined, records),
    midwest: teamsIn(assignment, "midwest", undefined, records),
    west: teamsIn(assignment, "west", undefined, records),
  };
}
