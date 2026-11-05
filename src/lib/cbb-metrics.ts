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

export function meanRanks(...values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function resumeAverage(metrics?: CbbTeamMetrics | null): number | null {
  if (!metrics) return null;
  return meanRanks(metrics.sor, metrics.kpi, metrics.wab);
}

export function predictiveAverage(metrics?: CbbTeamMetrics | null): number | null {
  if (!metrics) return null;
  return meanRanks(metrics.kenpom, metrics.bpi, metrics.torvik);
}

/** Average of the resume and predictive group averages when either exists. */
export function overallAverage(metrics?: CbbTeamMetrics | null): number | null {
  return meanRanks(resumeAverage(metrics), predictiveAverage(metrics));
}

/** Left minus right. Negative means the left rank is better. */
export function rankDiff(left: number | null, right: number | null): number | null {
  if (left == null || right == null) return null;
  return left - right;
}

export function formatRankValue(value: number | null, digits = 1): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

export function formatQuad(record: QuadRecord | null): string {
  return record ? formatRecord(record.wins, record.losses) : "—";
}

export function formatDiff(diff: number | null): string {
  if (diff == null) return "—";
  if (diff === 0) return "0";
  const rounded = Number.isInteger(diff) ? String(Math.abs(diff)) : Math.abs(diff).toFixed(1);
  return diff < 0 ? `−${rounded}` : `+${rounded}`;
}

export function winPct(team: Pick<CbbTeam, "wins" | "losses">): number {
  const played = team.wins + team.losses;
  return played ? team.wins / played : 0;
}
