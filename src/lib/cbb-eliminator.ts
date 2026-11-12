import {
  firstIndexForSeed,
  seedForFieldIndex,
  seedLinePlayInTeams,
  seedLineSize,
  sortByMetrics,
} from "./cbb-bracket";
import { FIELD_SIZE } from "./cbb-season";
import type { CbbFieldRole, CbbTeam, CbbTeamMetrics } from "./cbb-types";

export type EliminatorStatus = "open" | "locked" | "eliminated";

export type EliminatorRole = CbbFieldRole | "conference-chase";

export type EliminatorRow = {
  teamId: string;
  rank: number;
  seed: number | null;
  playIn: boolean;
  role: EliminatorRole | null;
  inField: boolean;
  status: EliminatorStatus;
};

export function isAutoBidConference(name: string): boolean {
  return Boolean(name) && !/independent/i.test(name);
}

export function playInForFieldIndex(index: number): boolean {
  const seed = seedForFieldIndex(index);
  const offset = index - firstIndexForSeed(seed);
  return offset >= seedLineSize(seed) - seedLinePlayInTeams(seed);
}

export function eliminatorStatus(
  teamId: string,
  lockedIds: Iterable<string>,
  eliminatedIds: Iterable<string>,
): EliminatorStatus {
  const locked = lockedIds instanceof Set ? lockedIds : new Set(lockedIds);
  const eliminated = eliminatedIds instanceof Set ? eliminatedIds : new Set(eliminatedIds);
  if (eliminated.has(teamId)) return "eliminated";
  if (locked.has(teamId)) return "locked";
  return "open";
}

function bestEligibleByConference(
  teams: CbbTeam[],
  teamsById: Map<string, CbbTeam>,
  metrics: Map<string, CbbTeamMetrics>,
  eligible: Set<string>,
): Map<string, string> {
  const grouped = new Map<string, string[]>();
  for (const team of teams) {
    if (!eligible.has(team.id) || !isAutoBidConference(team.conference)) continue;
    const list = grouped.get(team.conference) ?? [];
    list.push(team.id);
    grouped.set(team.conference, list);
  }
  const best = new Map<string, string>();
  for (const [conference, ids] of grouped) {
    const top = sortByMetrics(ids, teamsById, metrics)[0];
    if (top) best.set(conference, top);
  }
  return best;
}

function selectFieldIds(
  rankedIds: string[],
  teamsById: Map<string, CbbTeam>,
  eligible: Set<string>,
  locked: Set<string>,
  autoBidIds: Set<string>,
): { fieldIds: string[]; roles: Map<string, CbbFieldRole> } {
  const roles = new Map<string, CbbFieldRole>();
  const fieldIds: string[] = [];
  const taken = new Set<string>();

  const take = (teamId: string, role: CbbFieldRole) => {
    if (taken.has(teamId) || !eligible.has(teamId) || fieldIds.length >= FIELD_SIZE) return;
    if (!teamsById.has(teamId)) return;
    fieldIds.push(teamId);
    taken.add(teamId);
    roles.set(teamId, role);
  };

  for (const teamId of rankedIds) {
    if (autoBidIds.has(teamId)) take(teamId, "auto-bid");
  }
  for (const teamId of rankedIds) {
    if (locked.has(teamId) && !taken.has(teamId)) take(teamId, "at-large");
  }
  for (const teamId of rankedIds) {
    if (fieldIds.length >= FIELD_SIZE) break;
    if (taken.has(teamId) || !eligible.has(teamId)) continue;
    take(teamId, "at-large");
  }

  return { fieldIds, roles };
}

/**
 * All D1 teams by six-rank average. Field seeds use the 76-team Opening Round
 * line sizes. Teams behind their conference leader inherit the seed of the
 * next auto-bid they rank ahead of — the seed they would hold if they won
 * their tournament and every other favorite won too.
 */
export function buildEliminatorBoard(
  teams: CbbTeam[],
  teamsById: Map<string, CbbTeam>,
  metrics: Map<string, CbbTeamMetrics>,
  lockedIds: Iterable<string> = [],
  eliminatedIds: Iterable<string> = [],
): EliminatorRow[] {
  const locked = new Set(lockedIds);
  const eliminated = new Set(eliminatedIds);
  for (const id of eliminated) locked.delete(id);

  const rankedIds = sortByMetrics(
    teams.map((team) => team.id),
    teamsById,
    metrics,
  );
  const eligible = new Set(rankedIds.filter((id) => !eliminated.has(id)));
  const autoByConf = bestEligibleByConference(teams, teamsById, metrics, eligible);
  const autoBidIds = new Set(autoByConf.values());
  const { fieldIds, roles } = selectFieldIds(rankedIds, teamsById, eligible, locked, autoBidIds);
  const fieldOrder = sortByMetrics(fieldIds, teamsById, metrics);
  const fieldIndex = new Map(fieldOrder.map((id, index) => [id, index]));

  const autoInField = fieldOrder
    .filter((id) => roles.get(id) === "auto-bid")
    .map((id) => ({
      teamId: id,
      seed: seedForFieldIndex(fieldIndex.get(id)!),
      playIn: playInForFieldIndex(fieldIndex.get(id)!),
    }));

  const chaseSeed = (teamId: string): { seed: number; playIn: boolean } | null => {
    const team = teamsById.get(teamId);
    if (!team || !isAutoBidConference(team.conference) || !eligible.has(teamId)) return null;
    if (autoBidIds.has(teamId)) return null;
    for (const auto of autoInField) {
      if (auto.teamId === teamId) continue;
      if (sortByMetrics([teamId, auto.teamId], teamsById, metrics)[0] === teamId) {
        return { seed: auto.seed, playIn: auto.playIn };
      }
    }
    const worst = autoInField.at(-1);
    return worst ? { seed: worst.seed, playIn: true } : { seed: 16, playIn: true };
  };

  return rankedIds.map((teamId, index) => {
    const status = eliminated.has(teamId) ? "eliminated" : locked.has(teamId) ? "locked" : "open";
    const indexInField = fieldIndex.get(teamId);
    if (indexInField != null) {
      return {
        teamId,
        rank: index + 1,
        seed: seedForFieldIndex(indexInField),
        playIn: playInForFieldIndex(indexInField),
        role: roles.get(teamId) ?? "at-large",
        inField: true,
        status,
      };
    }
    const chase = status === "eliminated" ? null : chaseSeed(teamId);
    return {
      teamId,
      rank: index + 1,
      seed: chase?.seed ?? null,
      playIn: chase?.playIn ?? false,
      role: chase ? "conference-chase" : null,
      inField: false,
      status,
    };
  });
}
