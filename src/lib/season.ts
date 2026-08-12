import type { SeasonWeek } from "./types";

export const SEASON_YEAR = 2026;
export const FBS_TEAM_COUNT = 138;
/** SOS treats FCS opponents as one spot below the full FBS field */
export const FCS_SOS_RANK = FBS_TEAM_COUNT + 1;
/** Ranking ballot week before Week 1 kickoff */
export const PRESEASON_WEEK = 0;
export const STORAGE_KEY = `cfb26-rankings-v2-${SEASON_YEAR}`;
export const LEGACY_STORAGE_KEY = `cfb26-rankings-v1-${SEASON_YEAR}`;
export const AUTH_COOKIE = "cfb26_auth";

export function formatWeekLabel(week: number, fallbackLabel?: string): string {
  if (fallbackLabel) return fallbackLabel;
  if (week === PRESEASON_WEEK) return "Preseason";
  return `Week ${week}`;
}

/** Always put Preseason first in the ranking-week list. */
export function ensurePreseasonWeek(
  weeks: SeasonWeek[],
  year = SEASON_YEAR,
): SeasonWeek[] {
  const regular = weeks.filter((w) => w.number !== PRESEASON_WEEK);
  const first = regular[0];
  const preseasonEnd = first?.startDate
    ? new Date(new Date(first.startDate).getTime() - 1).toISOString()
    : `${year}-08-23T23:59:59.000Z`;
  const existing = weeks.find((w) => w.number === PRESEASON_WEEK);
  const preseason: SeasonWeek = existing ?? {
    number: PRESEASON_WEEK,
    label: "Preseason",
    detail: "Preseason rankings",
    startDate: `${year}-01-01T00:00:00.000Z`,
    endDate: preseasonEnd,
  };
  return [preseason, ...regular];
}
