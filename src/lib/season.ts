export const SEASON_YEAR = 2026;
export const FBS_TEAM_COUNT = 138;
/** SOS treats FCS opponents as one spot below the full FBS field */
export const FCS_SOS_RANK = FBS_TEAM_COUNT + 1;
/** Ballot-only week before any games */
export const PRESEASON_WEEK = -1;
/** Early-season games ESPN bundles into Week 1 (before Sept) */
export const WEEK_ZERO = 0;
export const STORAGE_KEY = `cfb26-rankings-v2-${SEASON_YEAR}`;
export const LEGACY_STORAGE_KEY = `cfb26-rankings-v1-${SEASON_YEAR}`;
export const AUTH_COOKIE = "cfb26_auth";

/** Games before this instant (ESPN Week 1 slate) are shown as Week 0. */
export function weekZeroCutoffIso(year = SEASON_YEAR): string {
  return `${year}-09-01T00:00:00.000Z`;
}

export function formatWeekLabel(week: number, fallbackLabel?: string): string {
  if (week === PRESEASON_WEEK) return "Preseason";
  if (week === WEEK_ZERO) return "Week 0";
  if (fallbackLabel) return fallbackLabel;
  return `Week ${week}`;
}

/** Compact schedule label: Pre / W0 / W1… */
export function formatGameWeekShort(week: number): string {
  if (week === PRESEASON_WEEK) return "Pre";
  if (week === WEEK_ZERO) return "W0";
  return `W${week}`;
}
