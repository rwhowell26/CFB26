import {
  PRESEASON_WEEK,
  SEASON_YEAR,
  WEEK_ZERO,
  weekZeroCutoffIso,
} from "./season";
import type { SeasonWeek } from "./types";

/**
 * Preseason (ballot only) → Week 0 (early games) → Week 1+ from ESPN.
 * ESPN folds Week 0 games into Week 1; we split the calendar dates.
 */
export function ensureSeasonWeeks(
  regularWeeks: SeasonWeek[],
  year = SEASON_YEAR,
): SeasonWeek[] {
  const espnWeeks = regularWeeks.filter(
    (w) => w.number !== PRESEASON_WEEK && w.number !== WEEK_ZERO,
  );
  const week1 = espnWeeks.find((w) => w.number === 1);
  const cutoff = weekZeroCutoffIso(year);

  const week0Start = week1?.startDate ?? `${year}-08-22T07:00:00.000Z`;
  const week0End = new Date(new Date(cutoff).getTime() - 1).toISOString();

  const week0: SeasonWeek = {
    number: WEEK_ZERO,
    label: "Week 0",
    detail: "Early season games",
    startDate: week0Start,
    endDate: week0End,
  };

  const adjusted = espnWeeks.map((w) => {
    if (w.number !== 1) return w;
    return {
      ...w,
      startDate: cutoff,
      detail: w.detail || "Week 1",
    };
  });

  const preseason: SeasonWeek = {
    number: PRESEASON_WEEK,
    label: "Preseason",
    detail: "Preseason rankings (before Week 0 games)",
    startDate: `${year}-01-01T00:00:00.000Z`,
    endDate: new Date(new Date(week0Start).getTime() - 1).toISOString(),
  };

  return [preseason, week0, ...adjusted];
}

/** @deprecated use ensureSeasonWeeks */
export function ensurePreseasonWeek(
  weeks: SeasonWeek[],
  year = SEASON_YEAR,
): SeasonWeek[] {
  return ensureSeasonWeeks(weeks, year);
}
