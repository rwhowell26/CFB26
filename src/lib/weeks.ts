import { PRESEASON_WEEK, SEASON_YEAR } from "./season";
import type { SeasonWeek } from "./types";

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
