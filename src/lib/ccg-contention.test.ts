import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENARIO_CONFERENCES } from "./scenario-conferences.ts";
import {
  conferenceContention,
  eliminationGamesThisWeek,
  gameImplications,
} from "./ccg-contention.ts";
import type { Game, Team } from "./types.ts";

function team(id: string, conference: string): Team {
  return {
    id,
    name: id,
    shortName: id,
    abbreviation: id,
    conference,
    logo: null,
    color: null,
    alternateColor: null,
  };
}

function game(
  id: string,
  home: string,
  away: string,
  winner: string | null,
  week = 1,
  conferenceGroup = "American Conference",
): Game {
  const final = winner != null;
  return {
    id,
    week,
    date: `2026-09-${String(week).padStart(2, "0")}T19:00:00.000Z`,
    neutralSite: false,
    status: final ? "final" : "scheduled",
    homeTeamId: home,
    awayTeamId: away,
    homeScore: final ? (winner === home ? 24 : 17) : null,
    awayScore: final ? (winner === away ? 24 : 17) : null,
    homeName: home,
    awayName: away,
    homeLogo: null,
    awayLogo: null,
    homeColor: null,
    awayColor: null,
    homeAlternateColor: null,
    awayAlternateColor: null,
    homeIsFbs: true,
    awayIsFbs: true,
    conferenceGame: true,
    championshipGame: false,
    conferenceGroup,
  };
}

const AAC = SCENARIO_CONFERENCES.find((conf) => conf.id === "aac")!;
const TEAMS = ["NAVY", "TULN", "MEM", "USF", "FAU"].map((id) =>
  team(id, "American Conference"),
);

test("a team that must win this week to keep a CCG path is out with a loss", () => {
  const games = [
    game("1", "NAVY", "USF", "NAVY"),
    game("2", "NAVY", "FAU", "NAVY"),
    game("3", "TULN", "USF", "TULN"),
    game("4", "TULN", "FAU", "TULN"),
    game("5", "MEM", "FAU", "MEM"),
    game("6", "MEM", "USF", null, 8),
  ];
  const result = conferenceContention(AAC, TEAMS, games, { week: 8 });
  assert.equal(result.byTeam.get("MEM")?.status, "out-loss");
  assert.equal(result.byTeam.get("MEM")?.survivesNextLoss, false);
  assert.equal(result.byTeam.get("FAU")?.status, "eliminated");
  assert.equal(result.byTeam.get("NAVY")?.hasPath, true);
  assert.equal(result.byTeam.get("TULN")?.hasPath, true);
  const memElim = eliminationGamesThisWeek(AAC, "MEM", TEAMS, games, { week: 8 });
  assert.ok(
    memElim.some(
      (item) =>
        item.game.id === "6" &&
        item.eliminatesIf.winnerId === "USF" &&
        item.eliminatesIf.teamIds.includes("MEM"),
    ),
  );
});

test("winning this week's game to lock a CCG berth is gold clinch", () => {
  const games = [
    game("1", "NAVY", "TULN", "NAVY"),
    game("2", "NAVY", "MEM", "NAVY"),
    game("3", "NAVY", "USF", "NAVY"),
    game("4", "NAVY", "FAU", null, 8),
    game("5", "TULN", "MEM", "TULN"),
    game("6", "TULN", "FAU", "TULN"),
    game("7", "MEM", "FAU", "MEM"),
    game("8", "USF", "FAU", "USF"),
  ];
  const result = conferenceContention(AAC, TEAMS, games, { week: 8 });
  assert.equal(result.byTeam.get("NAVY")?.status, "clinch");
  assert.equal(result.byTeam.get("NAVY")?.clinchesThisWin, true);
  assert.equal(result.byTeam.get("NAVY")?.clinchesWinOut, true);
  assert.equal(result.byTeam.get("FAU")?.status, "eliminated");
});

test("winning out is destiny when this week's win is not enough to clinch", () => {
  const games = [
    game("1", "NAVY", "USF", "NAVY"),
    game("2", "TULN", "FAU", "TULN"),
    game("3", "TULN", "USF", "TULN"),
    game("4", "MEM", "FAU", "MEM"),
    game("5", "NAVY", "FAU", null, 8),
    game("6", "NAVY", "TULN", null, 9),
    game("7", "NAVY", "MEM", null, 9),
  ];
  const result = conferenceContention(AAC, TEAMS, games, { week: 8 });
  assert.equal(result.byTeam.get("NAVY")?.clinchesWinOut, true);
  assert.equal(result.byTeam.get("NAVY")?.clinchesThisWin, false);
  assert.equal(result.byTeam.get("NAVY")?.status, "destiny");
});

const SBC = SCENARIO_CONFERENCES.find((conf) => conf.id === "sunbelt")!;
const APP = "2026";
const GASO = "290";
const JMU = "256";
const GSU = "2247";
const MARSHALL = "276";
const COASTAL = "324";
const ODU = "295";
const WEST = ["2348", "309", "6", "2032", "2653", "2572", "2433"] as const;

function sbcTeam(id: string, division: "east" | "west"): Team {
  return team(id, division === "east" ? "Sun Belt - East" : "Sun Belt - West");
}

const SBC_TEAMS: Team[] = [
  ...[JMU, APP, MARSHALL, GASO, GSU, COASTAL, ODU].map((id) => sbcTeam(id, "east")),
  ...WEST.map((id) => sbcTeam(id, "west")),
];

function sbc(
  id: string,
  home: string,
  away: string,
  winner: string | null,
  week = 1,
): Game {
  return game(id, home, away, winner, week, "Sun Belt Conference");
}

test("a division path after a next-game loss is alive, not out with a loss", () => {
  // East snapshot: GASO 3-1, JMU 4-2, App 2-2, GSU 2-2.
  // App's next game is vs GSU. Lose that, win the rest, and East rivals lose
  // remaining cross-division games → App 5-3 wins the East.
  // The old othersFall heuristic handed GSU those same West wins plus the App
  // H2H, so GSU 5-3 "clinched" and App was falsely marked out-with-a-loss.
  const next = sbc("next", APP, GSU, null, 10);
  const games = [
    sbc("a1", APP, COASTAL, APP),
    sbc("a2", APP, ODU, APP),
    sbc("a3", JMU, APP, JMU),
    sbc("a4", MARSHALL, APP, MARSHALL),
    sbc("g1", GASO, MARSHALL, GASO),
    sbc("g2", GASO, COASTAL, GASO),
    sbc("g3", GASO, ODU, GASO),
    sbc("g4", JMU, GASO, JMU),
    sbc("j1", JMU, MARSHALL, JMU),
    sbc("j2", JMU, COASTAL, JMU),
    sbc("j3", WEST[0], JMU, WEST[0]),
    sbc("j4", WEST[1], JMU, WEST[1]),
    sbc("s1", GSU, MARSHALL, GSU),
    sbc("s2", GSU, ODU, GSU),
    sbc("s3", COASTAL, GSU, COASTAL),
    sbc("s4", WEST[2], GSU, WEST[2]),
    next,
    sbc("ar1", APP, WEST[3], null, 11),
    sbc("ar2", APP, WEST[4], null, 12),
    sbc("ar3", APP, WEST[5], null, 13),
    sbc("gr1", GASO, WEST[5], null, 11),
    sbc("gr2", GASO, WEST[6], null, 12),
    sbc("jr1", JMU, WEST[6], null, 11),
    sbc("sr1", GSU, WEST[0], null, 11),
    sbc("sr2", GSU, WEST[1], null, 12),
  ];
  const result = conferenceContention(SBC, SBC_TEAMS, games, { week: 10 });
  const app = result.byTeam.get(APP);
  assert.equal(app?.hasPath, true);
  assert.equal(app?.survivesNextLoss, true);
  assert.equal(app?.clinchesWinOut, false);
  assert.equal(app?.status, "alive");
  const appElim = eliminationGamesThisWeek(SBC, APP, SBC_TEAMS, games, { week: 10 });
  assert.equal(
    appElim.some((item) => item.game.id === "next" && item.eliminatesIf.winnerId === GSU),
    false,
  );
});

test("clicking a conference game reports who a result would eliminate", () => {
  const leftover = game("6", "MEM", "USF", null, 8);
  const games = [
    game("1", "NAVY", "USF", "NAVY"),
    game("2", "NAVY", "FAU", "NAVY"),
    game("3", "TULN", "USF", "TULN"),
    game("4", "TULN", "FAU", "TULN"),
    game("5", "MEM", "FAU", "MEM"),
    leftover,
  ];
  const implications = gameImplications(leftover, TEAMS, games, { week: 8 });
  assert.ok(implications);
  const usfWins = implications!.outcomes.find((row) => row.winnerId === "USF");
  assert.ok(usfWins?.newlyEliminated.includes("MEM"));
});
