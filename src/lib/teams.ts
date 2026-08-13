import teamsJson from "@/data/teams.json";
import type { Assignment, RegionId, Team, TierId } from "./types";

export const TEAMS: Team[] = teamsJson as Team[];

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((team) => [team.id, team]),
);

export const REGIONS: Array<{
  id: RegionId;
  name: string;
  short: string;
  blurb: string;
  accent: string;
}> = [
  {
    id: "east",
    name: "East",
    short: "East",
    blurb: "Atlantic seaboard, Appalachia, and Kentucky",
    accent: "#3b82f6",
  },
  {
    id: "south",
    name: "South",
    short: "South",
    blurb: "Deep South, Florida, Tennessee, and Texas A&M / Houston",
    accent: "#ef4444",
  },
  {
    id: "midwest",
    name: "Midwest",
    short: "Midwest",
    blurb: "Great Lakes, Plains, Oklahoma, and North Texas / Big 12 Texas",
    accent: "#f59e0b",
  },
  {
    id: "west",
    name: "West",
    short: "West",
    blurb: "Texas, the Mountain West, and the Pacific",
    accent: "#14b8a6",
  },
];

export const TIER_META: Record<
  TierId,
  { name: string; short: string; detail: string }
> = {
  1: {
    name: "Tier I",
    short: "I",
    detail: "Top band in the region — extra playoff access",
  },
  2: {
    name: "Tier II",
    short: "II",
    detail: "Middle band — autobid for the champion",
  },
  3: {
    name: "Tier III",
    short: "III",
    detail: "Development band — still has an autobid path",
  },
};

export function defaultAssignment(): Assignment {
  return Object.fromEntries(
    TEAMS.map((team) => [team.id, { region: team.region, tier: team.tier as TierId }]),
  );
}

export function winPct(team: Team): number {
  const games = team.wins + team.losses;
  return games ? team.wins / games : 0;
}

export function recordLabel(team: Team): string {
  return `${team.wins}-${team.losses}`;
}

export function compareRecords(a: Team, b: Team): number {
  const pct = winPct(b) - winPct(a);
  if (pct !== 0) return pct;
  if (b.wins !== a.wins) return b.wins - a.wins;
  const diff = b.pf - b.pa - (a.pf - a.pa);
  if (diff !== 0) return diff;
  return a.shortName.localeCompare(b.shortName);
}

export function getTeam(id: string): Team {
  const team = TEAM_BY_ID[id];
  if (!team) throw new Error(`Unknown team id ${id}`);
  return team;
}
