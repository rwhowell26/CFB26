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
): Game {
  const final = winner != null;
  return {
    id,
    week,
    date: `2026-09-0${week}T19:00:00.000Z`,
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
    conferenceGroup: "American Conference",
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
