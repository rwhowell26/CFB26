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
