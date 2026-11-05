import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyPlayoffRace } from "./playoff-race.ts";
import {
  applyPlayoffGame,
  ccgStatusToPlayoff,
  syncPlayoffStatuses,
} from "./playoff-scenario-sync.ts";
import type { Game, PlayoffRaceState, Team } from "./types.ts";

const AAC = "American Conference";
const SEC = "Southeastern Conference";

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
  extras: Partial<Game> = {},
): Game {
  const final = winner != null;
  return {
    id,
    week: 14,
    date: "2026-12-05T20:00:00.000Z",
    neutralSite: false,
    status: final ? "final" : "scheduled",
    homeTeamId: home,
    awayTeamId: away,
    homeScore: final ? (winner === home ? 31 : 14) : null,
    awayScore: final ? (winner === away ? 31 : 14) : null,
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
    conferenceGroup: AAC,
    ...extras,
  };
}

const TEAMS = ["NAVY", "TULN", "MEM", "USF", "FAU"].map((id) => team(id, AAC));
const WITH_SEC = [...TEAMS, team("UGA", SEC), team("BAMA", SEC)];

const SEEDED = { date: "2026-10-20T19:00:00.000Z" };
const CLINCH_GAMES = [
  game("1", "NAVY", "TULN", "NAVY"),
  game("2", "NAVY", "MEM", "NAVY"),
  game("3", "NAVY", "USF", "NAVY"),
  game("4", "NAVY", "FAU", null),
  game("5", "TULN", "MEM", "TULN", SEEDED),
  game("6", "TULN", "FAU", "TULN", SEEDED),
  game("7", "MEM", "FAU", "MEM", SEEDED),
  game("8", "USF", "FAU", "USF", SEEDED),
];

function state(partial: Partial<PlayoffRaceState> = {}): PlayoffRaceState {
  return { ...emptyPlayoffRace(), ...partial };
}

test("clinch maps to Playoff destiny", () => {
  assert.equal(ccgStatusToPlayoff("clinch"), "destiny");
  assert.equal(ccgStatusToPlayoff("alive"), "alive");
  assert.equal(ccgStatusToPlayoff("out-loss"), "out-loss");
});

test("applying a completed game refreshes every conference category", () => {
  let live = state({
    status: { NAVY: "alive", UGA: "alive", BAMA: "alive" },
  });
  live = applyPlayoffGame(live, CLINCH_GAMES[0]!, WITH_SEC, CLINCH_GAMES);
  live = applyPlayoffGame(live, CLINCH_GAMES[1]!, WITH_SEC, CLINCH_GAMES);
  live = applyPlayoffGame(live, CLINCH_GAMES[2]!, WITH_SEC, CLINCH_GAMES);
  assert.deepEqual(live.appliedGameIds, ["1", "2", "3"]);
  assert.equal(live.status.NAVY, "destiny");
  assert.equal(live.status.FAU, "eliminated");
  assert.ok(live.status.UGA);
  assert.ok(live.status.BAMA);
});

test("judgement eliminate is not restored by scenario sync", () => {
  const live = syncPlayoffStatuses(
    state({
      appliedGameIds: ["1", "2", "3"],
      playoffEliminatedIds: ["NAVY"],
      status: { NAVY: "eliminated" },
    }),
    TEAMS,
    CLINCH_GAMES,
  );
  assert.equal(live.status.NAVY, "eliminated");
});
