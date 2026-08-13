import teamsJson from "@/data/teams.json";
import type { Assignment, RegionId, RivalMap, Team, TierId } from "./types";

export const TEAMS: Team[] = teamsJson as Team[];

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((team) => [team.id, team]),
);

export const TIER_SIZE = 8;
export const PLAYOFF_TIERS = 3;
export const FCS_MIN_TIER = 3;
export const SEASON_WEEKS = 13;
export const MAX_GAMES = 12;
export const MAX_RIVALS = 3;
export const LEAGUE_BYE_WEEK = 6;
export const RR_START_WEEK = 7;
export const MAX_MOVEMENT = 3;

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function tierName(tier: TierId): string {
  return `Tier ${ROMAN[tier] ?? tier}`;
}

export function tierShort(tier: TierId): string {
  return ROMAN[tier] ?? String(tier);
}

export const REGIONS: Array<{
  id: RegionId;
  name: string;
  short: string;
  code: string;
  blurb: string;
  accent: string;
}> = [
  {
    id: "east",
    name: "East",
    short: "East",
    code: "E",
    blurb: "Atlantic seaboard, Appalachia, and Kentucky",
    accent: "#3b82f6",
  },
  {
    id: "south",
    name: "South",
    short: "South",
    code: "S",
    blurb: "Deep South, Florida, Tennessee, and Texas A&M / Houston",
    accent: "#ef4444",
  },
  {
    id: "midwest",
    name: "Midwest",
    short: "Midwest",
    code: "MW",
    blurb: "Great Lakes, Plains, Oklahoma, and North Texas",
    accent: "#f59e0b",
  },
  {
    id: "west",
    name: "West",
    short: "West",
    code: "W",
    blurb: "Texas, the Mountain West, and the Pacific",
    accent: "#14b8a6",
  },
];

export function regionCode(id: RegionId): string {
  return REGIONS.find((region) => region.id === id)?.code ?? id.slice(0, 1).toUpperCase();
}

export function defaultAssignment(): Assignment {
  return Object.fromEntries(
    TEAMS.map((team) => [team.id, { region: team.region, tier: team.tier }]),
  );
}

export function defaultRivals(): RivalMap {
  return Object.fromEntries(TEAMS.map((team) => [team.id, [...team.rivals]]));
}

export function winPct(team: Team): number {
  const games = team.wins + team.losses;
  return games ? team.wins / games : 0;
}

export function recordLabel(team: Team): string {
  return `${team.wins}-${team.losses}`;
}

export function recordLabel5(team: Team): string {
  return `${team.wins5}-${team.losses5}`;
}

export function spPlusLabel(team: Team): string {
  if (team.spPlus == null || team.spPlusRank == null) return "No SP+ (FCS)";
  const rating = team.spPlus > 0 ? `+${team.spPlus.toFixed(1)}` : team.spPlus.toFixed(1);
  return `SP+ ${rating} · #${team.spPlusRank}`;
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

export function clampTier(team: Team, tier: TierId): TierId {
  if (team.subdivision === "fcs" && tier < FCS_MIN_TIER) return FCS_MIN_TIER;
  return tier;
}

export function canPromoteTo(team: Team, tier: TierId): boolean {
  return team.subdivision !== "fcs" || tier >= FCS_MIN_TIER;
}

export function regionName(id: RegionId): string {
  return REGIONS.find((region) => region.id === id)?.name ?? id;
}
