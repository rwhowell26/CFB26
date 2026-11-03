import type { Game, SeasonWeek } from "./types";

const ZONE = "America/Chicago";
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function chicagoParts(date: Date): { ymd: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = WEEKDAY_INDEX[get("weekday")] ?? 0;
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    weekday,
  };
}

export function chicagoYmd(date: Date): string {
  return chicagoParts(date).ymd;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

/** Sunday (Chicago) on or after this instant — Saturday slates unlock the next morning. */
export function sundayOnOrAfter(date: Date): string {
  const { ymd, weekday } = chicagoParts(date);
  if (weekday === 0) return ymd;
  return addDaysYmd(ymd, 7 - weekday);
}

export function rankingUnlockYmd(week: SeasonWeek, games: Game[]): string {
  const weekGames = games.filter((game) => game.week === week.number);
  if (weekGames.length) {
    const last = weekGames.reduce((best, game) => (game.date > best.date ? game : best));
    return sundayOnOrAfter(new Date(last.date));
  }
  const end = new Date(week.endDate);
  const { ymd, weekday } = chicagoParts(end);
  // ESPN windows end Monday 1–2am Chicago; that Sunday is the unlock.
  if (weekday === 1) return addDaysYmd(ymd, -1);
  return sundayOnOrAfter(end);
}

/**
 * Latest ranking week whose Sunday has arrived in America/Chicago.
 * Upcoming ESPN weeks (e.g. Week 10 on a Tuesday) stay closed until Sunday.
 */
export function latestCompletedRankingWeek(
  weeks: SeasonWeek[],
  games: Game[],
  now = new Date(),
): number {
  const today = chicagoYmd(now);
  const playWeeks = [...weeks]
    .filter((week) => week.number >= 0)
    .sort((a, b) => a.number - b.number);
  let latest = -1;
  for (const week of playWeeks) {
    if (today >= rankingUnlockYmd(week, games)) latest = week.number;
  }
  return latest;
}
