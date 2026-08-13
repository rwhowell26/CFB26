import pairsJson from "@/data/rivalries.json";
import { TEAMS } from "./teams";

const BY_ABBR: Record<string, string> = Object.fromEntries(
  TEAMS.map((team) => [team.abbreviation, team.id]),
);

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const REAL_PAIR_KEYS = new Set(
  (pairsJson as Array<[string, string]>).flatMap(([a, b]) => {
    const aId = BY_ABBR[a];
    const bId = BY_ABBR[b];
    return aId && bId ? [pairKey(aId, bId)] : [];
  }),
);

const REAL_BY_TEAM: Record<string, string[]> = {};
for (const [a, b] of pairsJson as Array<[string, string]>) {
  const aId = BY_ABBR[a];
  const bId = BY_ABBR[b];
  if (!aId || !bId || aId === bId) continue;
  if (!(REAL_BY_TEAM[aId] ?? []).includes(bId)) {
    REAL_BY_TEAM[aId] = [...(REAL_BY_TEAM[aId] ?? []), bId];
  }
  if (!(REAL_BY_TEAM[bId] ?? []).includes(aId)) {
    REAL_BY_TEAM[bId] = [...(REAL_BY_TEAM[bId] ?? []), aId];
  }
}

export function isRealRivalry(aId: string, bId: string): boolean {
  return aId !== bId && REAL_PAIR_KEYS.has(pairKey(aId, bId));
}

export function realRivalIds(teamId: string): string[] {
  return REAL_BY_TEAM[teamId] ?? [];
}
