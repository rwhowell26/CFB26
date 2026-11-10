import type { CbbTeam, CbbTeamMetrics, QuadRecord } from "./cbb-types";

export function emptyMetrics(teamId: string): CbbTeamMetrics {
  return {
    teamId,
    sor: null,
    kpi: null,
    wab: null,
    kenpom: null,
    bpi: null,
    torvik: null,
    quad1: null,
    quad2: null,
    quad3: null,
    quad4: null,
  };
}

export function meanRatings(...values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function resumeAverage(metrics?: CbbTeamMetrics | null): number | null {
  if (!metrics) return null;
  return meanRatings(metrics.sor, metrics.kpi, metrics.wab);
}

export function predictiveAverage(metrics?: CbbTeamMetrics | null): number | null {
  if (!metrics) return null;
  return meanRatings(metrics.kenpom, metrics.bpi, metrics.torvik);
}

/** Mean of all six published ranks that are present. Lower is better. */
export function overallAverage(metrics?: CbbTeamMetrics | null): number | null {
  if (!metrics) return null;
  return meanRatings(
    metrics.sor,
    metrics.kpi,
    metrics.wab,
    metrics.kenpom,
    metrics.bpi,
    metrics.torvik,
  );
}

/** Other minus self. Positive means this team has the better (lower) rank. */
export function rankAdvantage(self: number | null, other: number | null): number | null {
  if (self == null || other == null) return null;
  return other - self;
}

export function formatRank(value: number | null, digits = 0): string {
  if (value == null) return "—";
  if (digits <= 0) return String(Math.round(value));
  return value.toFixed(digits);
}

export function formatRankAdvantage(advantage: number | null): string {
  if (advantage == null) return "—";
  if (Math.abs(advantage) < 0.05) return "0";
  const abs = Math.abs(advantage);
  const rendered = Number.isInteger(abs) || Math.abs(abs - Math.round(abs)) < 0.05 ? String(Math.round(abs)) : abs.toFixed(1);
  return advantage > 0 ? `+${rendered}` : `−${rendered}`;
}

export function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

export function formatQuad(record: QuadRecord | null): string {
  return record ? formatRecord(record.wins, record.losses) : "—";
}

export function winPct(team: Pick<CbbTeam, "wins" | "losses">): number {
  const played = team.wins + team.losses;
  return played ? team.wins / played : 0;
}
