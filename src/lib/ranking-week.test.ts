import assert from "node:assert/strict";
import { test } from "node:test";
import {
  latestCompletedRankingWeek,
  rankingUnlockYmd,
  sundayOnOrAfter,
} from "./ranking-week.ts";
import type { Game, SeasonWeek } from "./types.ts";

function week(number: number, startDate: string, endDate: string): SeasonWeek {
  return {
    number,
    label: `Week ${number}`,
    detail: "",
    startDate,
    endDate,
  };
}

function game(weekNumber: number, date: string): Game {
  return {
    id: `${weekNumber}-${date}`,
    week: weekNumber,
    date,
    neutralSite: false,
    status: "final",
    homeTeamId: "1",
    awayTeamId: "2",
    homeScore: 21,
    awayScore: 14,
    homeName: "Home",
    awayName: "Away",
    homeLogo: null,
    awayLogo: null,
    homeIsFbs: true,
    awayIsFbs: true,
    homeColor: null,
    awayColor: null,
    homeAlternateColor: null,
    awayAlternateColor: null,
    conferenceGame: false,
    championshipGame: false,
    conferenceGroup: null,
  };
}

const WEEKS_2026 = [
  week(8, "2026-10-19T07:00:00.000Z", "2026-10-26T06:59:00.000Z"),
  week(9, "2026-10-26T07:00:00.000Z", "2026-11-02T07:59:00.000Z"),
  week(10, "2026-11-02T08:00:00.000Z", "2026-11-09T07:59:00.000Z"),
  week(11, "2026-11-09T08:00:00.000Z", "2026-11-16T07:59:00.000Z"),
];

const GAMES = [
  game(9, "2026-10-31T19:00:00.000Z"),
  game(10, "2026-11-07T20:00:00.000Z"),
  game(11, "2026-11-14T20:00:00.000Z"),
];

test("Saturday night unlocks the following Sunday", () => {
  assert.equal(sundayOnOrAfter(new Date("2026-11-07T23:30:00.000Z")), "2026-11-08");
});

test("Week 10 unlocks Sunday after its Saturday slate", () => {
  assert.equal(rankingUnlockYmd(WEEKS_2026[2], GAMES), "2026-11-08");
});

test("Tuesday of Week 10 still opens Week 9", () => {
  const now = new Date("2026-11-03T16:00:00.000Z");
  assert.equal(latestCompletedRankingWeek(WEEKS_2026, GAMES, now), 9);
});

test("Sunday morning opens Week 10", () => {
  const now = new Date("2026-11-08T12:00:00.000Z");
  assert.equal(latestCompletedRankingWeek(WEEKS_2026, GAMES, now), 10);
});

test("Saturday of Week 10 still stays on Week 9", () => {
  const now = new Date("2026-11-07T23:00:00.000Z");
  assert.equal(latestCompletedRankingWeek(WEEKS_2026, GAMES, now), 9);
});
