import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatWinLoss,
  projectSunBelt,
  winningPct,
  type SunBeltRoster,
} from "./sunbelt.ts";
import type { Game, Team } from "./types.ts";

const ROSTER: SunBeltRoster = {
  east: ["A", "B", "C", "D", "F", "G", "H"],
  west: ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
};

function team(id: string, division: "east" | "west"): Team {
  return {
    id,
    name: id,
    shortName: id,
    abbreviation: id,
    conference: division === "east" ? "Sun Belt - East" : "Sun Belt - West",
    logo: null,
  };
}

const TEAMS: Team[] = [
  ...ROSTER.east.map((id) => team(id, "east")),
  ...ROSTER.west.map((id) => team(id, "west")),
];

let gameSeq = 0;

function confGame(
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  week = 1,
): Game {
  gameSeq += 1;
  return {
    id: `g${gameSeq}`,
    week,
    date: `2026-09-${String(10 + (week % 18)).padStart(2, "0")}T19:00:00.000Z`,
    neutralSite: false,
    status: "final",
    homeTeamId: home,
    awayTeamId: away,
    homeScore,
    awayScore,
    homeName: home,
    awayName: away,
    homeLogo: null,
    awayLogo: null,
    homeIsFbs: true,
    awayIsFbs: true,
  };
}

function scheduled(home: string, away: string, week = 10): Game {
  gameSeq += 1;
  return {
    id: `s${gameSeq}`,
    week,
    date: `2026-11-${String(week).padStart(2, "0")}T20:00:00.000Z`,
    neutralSite: false,
    status: "scheduled",
    homeTeamId: home,
    awayTeamId: away,
    homeScore: null,
    awayScore: null,
    homeName: home,
    awayName: away,
    homeLogo: null,
    awayLogo: null,
    homeIsFbs: true,
    awayIsFbs: true,
  };
}

function project(games: Game[], picks?: Record<string, string>) {
  return projectSunBelt(TEAMS, games, { roster: ROSTER, picks });
}

test("conference winning percentage ranks the division", () => {
  const games = [
    confGame("A", "B", 21, 7),
    confGame("A", "C", 24, 10),
    confGame("B", "C", 17, 14),
  ];
  const east = project(games).east;
  assert.equal(east.rows[0].teamId, "A");
  assert.equal(formatWinLoss(east.rows[0].conf), "2-0");
  assert.equal(east.rows[1].teamId, "B");
  assert.equal(east.rows[2].teamId, "C");
  assert.match(east.champExplanation, /conference winning percentage/);
});

test("two-team tie uses head-to-head", () => {
  const games = [
    confGame("A", "C", 1, 0),
    confGame("D", "A", 1, 0),
    confGame("A", "B", 1, 0),
    confGame("B", "C", 1, 0),
    confGame("B", "D", 1, 0),
  ];
  const east = project(games).east;
  assert.equal(formatWinLoss(east.rows[0].conf), "2-1");
  assert.equal(formatWinLoss(east.rows[1].conf), "2-1");
  assert.equal(east.rows[0].teamId, "A");
  assert.equal(east.rows[1].teamId, "B");
  assert.match(east.rows[0].tieNote ?? "", /head-to-head/i);
});

test("two-team tie without a meeting uses division winning percentage", () => {
  const games = [
    confGame("A", "C", 1, 0),
    confGame("A", "D", 1, 0),
    confGame("W1", "A", 1, 0),
    confGame("B", "C", 1, 0),
    confGame("D", "B", 1, 0),
    confGame("B", "W1", 1, 0),
  ];
  const east = project(games).east;
  assert.equal(east.rows[0].teamId, "A");
  assert.equal(east.rows[1].teamId, "B");
  assert.equal(formatWinLoss(east.rows[0].conf), "2-1");
  assert.equal(formatWinLoss(east.rows[1].conf), "2-1");
  assert.equal(formatWinLoss(east.rows[0].division), "2-0");
  assert.equal(formatWinLoss(east.rows[1].division), "1-1");
  assert.match(east.rows[0].tieNote ?? "", /division/i);
});

test("two-team walk uses record vs the next-highest team in the standings", () => {
  const games = [
    confGame("A", "C", 1, 0),
    confGame("D", "A", 1, 0),
    confGame("A", "F", 1, 0),
    confGame("A", "G", 1, 0),
    confGame("B", "C", 1, 0),
    confGame("B", "D", 1, 0),
    confGame("B", "F", 1, 0),
    confGame("G", "B", 1, 0),
    confGame("C", "H", 1, 0),
    confGame("D", "H", 1, 0),
  ];
  const east = project(games).east;
  assert.equal(formatWinLoss(east.rows[0].conf), "3-1");
  assert.equal(formatWinLoss(east.rows[1].conf), "3-1");
  assert.equal(east.rows[0].teamId, "B");
  assert.equal(east.rows[1].teamId, "A");
  assert.match(east.rows[0].tieNote ?? "", /next-highest/i);
});

test("multi-team tie uses winning percentage among the tied teams", () => {
  const games = [
    confGame("A", "B", 1, 0),
    confGame("A", "C", 1, 0),
    confGame("B", "C", 1, 0),
    confGame("W1", "A", 1, 0),
    confGame("W2", "A", 1, 0),
    confGame("W1", "B", 1, 0),
    confGame("B", "W2", 1, 0),
    confGame("C", "W1", 1, 0),
    confGame("C", "W2", 1, 0),
  ];
  const east = project(games).east;
  assert.deepEqual(
    east.rows.slice(0, 3).map((row) => row.teamId),
    ["A", "B", "C"],
  );
  assert.equal(formatWinLoss(east.rows[0].conf), "2-2");
  assert.match(east.rows[0].tieNote ?? "", /among the tied/i);
});

test("multi-team remainder of two reverts to the two-team head-to-head start", () => {
  const games = [
    confGame("A", "B", 1, 0),
    confGame("B", "C", 1, 0),
    confGame("C", "A", 1, 0),
    confGame("A", "D", 1, 0),
    confGame("B", "F", 1, 0),
    confGame("C", "W1", 1, 0),
  ];
  const east = project(games).east;
  assert.equal(formatWinLoss(east.rows[0].conf), "2-1");
  assert.equal(formatWinLoss(east.rows[1].conf), "2-1");
  assert.equal(formatWinLoss(east.rows[2].conf), "2-1");
  assert.equal(east.rows[0].teamId, "A");
  assert.equal(east.rows[1].teamId, "B");
  assert.equal(east.rows[2].teamId, "C");
  assert.match(east.champExplanation, /divisional|head-to-head/i);
});

test("picks on remaining games change the projected champion", () => {
  const leftover = scheduled("C", "A", 12);
  const games = [
    confGame("A", "B", 1, 0),
    confGame("C", "B", 1, 0),
    leftover,
  ];
  const before = project(games);
  assert.equal(before.east.rows[0].teamId, "A");
  assert.equal(before.unpickedCount, 1);
  const after = project(games, { [leftover.id]: "C" });
  assert.equal(after.unpickedCount, 0);
  assert.equal(after.east.rows[0].teamId, "C");
  assert.equal(formatWinLoss(after.east.rows[0].conf), "2-0");
});

test("CFP ranked team that wins the final weekend breaks a two-team tie", () => {
  const games = [
    confGame("A", "C", 1, 0, 1),
    confGame("W1", "A", 1, 0, 1),
    confGame("B", "C", 1, 0, 1),
    confGame("W1", "B", 1, 0, 1),
    confGame("A", "F", 1, 0, 14),
    confGame("B", "G", 1, 0, 14),
  ];
  const east = projectSunBelt(TEAMS, games, {
    roster: ROSTER,
    cfpRanks: new Map([["A", 21]]),
  }).east;
  assert.equal(east.rows[0].teamId, "A");
  assert.match(east.rows[0].tieNote ?? "", /CFP/i);
});

test("higher conference percentage hosts the championship", () => {
  const games = [
    confGame("A", "B", 1, 0),
    confGame("A", "C", 1, 0),
    confGame("A", "D", 1, 0),
    confGame("W1", "W2", 1, 0),
    confGame("W1", "W3", 1, 0),
    confGame("W5", "W1", 1, 0),
    confGame("W2", "W5", 1, 0),
  ];
  const result = project(games);
  assert.equal(result.championship.eastId, "A");
  assert.equal(result.championship.hostId, "A");
  assert.match(result.championship.hostNote, /conference winning percentage/);
});

test("ties count as half a win", () => {
  const games = [confGame("A", "B", 21, 21)];
  const east = project(games).east;
  const a = east.rows.find((row) => row.teamId === "A");
  assert.equal(a?.conf.ties, 1);
  assert.equal(winningPct(a!.conf), 0.5);
});
