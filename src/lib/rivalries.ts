import pairsJson from "@/data/rivalries.json";
import weeksJson from "@/data/rivalry-weeks.json";
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

export type TraditionalDate = {
  week: number;
  name: string;
};

const TRADITIONAL_BY_PAIR = new Map<string, TraditionalDate>();
for (const row of weeksJson as Array<{ a: string; b: string; week: number; name: string }>) {
  const aId = BY_ABBR[row.a];
  const bId = BY_ABBR[row.b];
  if (!aId || !bId) continue;
  TRADITIONAL_BY_PAIR.set(pairKey(aId, bId), { week: row.week, name: row.name });
}

export const WEEK_TRADITION: Record<number, string> = {
  2: "Early September",
  7: "Second Saturday in October",
  8: "Third Saturday in October",
  9: "Last Saturday in October",
  11: "Second Saturday in November",
  12: "Week before Thanksgiving",
  13: "Thanksgiving week",
};

export function isRealRivalry(aId: string, bId: string): boolean {
  return aId !== bId && REAL_PAIR_KEYS.has(pairKey(aId, bId));
}

export function realRivalIds(teamId: string): string[] {
  return REAL_BY_TEAM[teamId] ?? [];
}

export function traditionalDate(aId: string, bId: string): TraditionalDate | undefined {
  return TRADITIONAL_BY_PAIR.get(pairKey(aId, bId));
}

export function traditionalPins(): Array<{ a: string; b: string; week: number; name: string }> {
  return [...TRADITIONAL_BY_PAIR.entries()].map(([key, value]) => {
    const [a, b] = key.split("|");
    return { a, b, week: value.week, name: value.name };
  });
}
