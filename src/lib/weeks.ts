import { PRESEASON_WEEK, SEASON_YEAR } from "./season";
import type { SeasonWeek } from "./types";

/** Always put Week 0 first in the ranking-week list. */
export function ensurePreseasonWeek(
  weeks: SeasonWeek[],
  year = SEASON_YEAR,
): SeasonWeek[] {
  const regular = weeks.filter((w) => w.number !== PRESEASON_WEEK);
  const first = regular[0];
  const week0End = first?.startDate
    ? new Date(new Date(first.startDate).getTime() - 1).toISOString()
    : `${year}-08-23T23:59:59.000Z`;
  const existing = weeks.find((w) => w.number === PRESEASON_WEEK);
  const week0: SeasonWeek = {
    number: PRESEASON_WEEK,
    label: "Week 0",
    detail: existing?.detail || "Week 0 / preseason rankings",
    startDate: existing?.startDate || `${year}-01-01T00:00:00.000Z`,
    endDate: existing?.endDate || week0End,
  };
  return [week0, ...regular];
}
