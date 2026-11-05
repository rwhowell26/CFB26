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

/** Mean of all six rating points that are present. */
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

/** Left minus right. Positive means the left rating is better. */
export function ratingDiff(left: number | null, right: number | null): number | null {
  if (left == null || right == null) return null;
  return left - right;
}

export function formatRating(value: number | null, digits = 1): string {
  if (value == null) return "—";
  const use = Math.abs(value) < 1 && value !== 0 ? 2 : digits;
  const rendered = value.toFixed(use);
  if (value > 0 && use > 0) return `+${rendered}`;
  return rendered;
}

export function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

export function formatQuad(record: QuadRecord | null): string {
  return record ? formatRecord(record.wins, record.losses) : "—";
}

export function formatDiff(diff: number | null): string {
  if (diff == null) return "—";
  if (Math.abs(diff) < 0.05) return "0";
  const rounded = Math.abs(diff) < 1 ? Math.abs(diff).toFixed(2) : Math.abs(diff).toFixed(1);
  return diff > 0 ? `+${rounded}` : `−${rounded}`;
}

export function winPct(team: Pick<CbbTeam, "wins" | "losses">): number {
  const played = team.wins + team.losses;
  return played ? team.wins / played : 0;
}
