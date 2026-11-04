import assert from "node:assert/strict";
import { test } from "node:test";
import {
  atLargePoolTeams,
  autoBidTeams,
  conferenceChampions,
  emptyPlayoffRace,
  eliminateFromAtLarge,
  playoffTables,
} from "./playoff-race.ts";
import type { CfpPoll, Game, PlayoffRaceState, Team } from "./types.ts";

function team(id: string, conference: string, name = id): Team {
  return {
    id,
    name,
    shortName: name,
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
    neutralSite: true,
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
    conferenceGame: extras.championshipGame ? false : true,
    championshipGame: false,
    conferenceGroup: "Atlantic Coast Conference",
    ...extras,
  };
}

function cfp(ranks: Array<[string, number]>): CfpPoll {
  return {
    published: true,
    week: 12,
    weekLabel: "Week 12",
    ranks: ranks.map(([teamId, rank]) => ({ teamId, rank, previous: null })),
  };
}

const ACC = "Atlantic Coast Conference";
const SEC = "Southeastern Conference";
const IND = "FBS Independents";

const TEAMS = [
  team("MIA", ACC, "Miami"),
  team("CLEM", ACC, "Clemson"),
  team("ALA", SEC, "Alabama"),
  team("UGA", SEC, "Georgia"),
  team("ND", IND, "Notre Dame"),
  team("GT", ACC, "Georgia Tech"),
  team("FSU", ACC, "Florida State"),
];

function state(partial: Partial<PlayoffRaceState> = {}): PlayoffRaceState {
  return {
    ...emptyPlayoffRace(),
    notreDameRecord: { wins: 8, losses: 1 },
    ...partial,
  };
}

test("auto bid is empty until a CCG is final", () => {
  const games = [game("acc-ccg", "MIA", "CLEM", null, { championshipGame: true })];
  assert.deepEqual(conferenceChampions(TEAMS, games), []);
  assert.deepEqual(autoBidTeams(TEAMS, games, cfp([["MIA", 3]])), []);
});

test("CCG winners fill auto bid, sorted by CFP then overall record", () => {
  const games = [
    game("acc-ccg", "MIA", "CLEM", "CLEM", { championshipGame: true, date: "2026-12-05T20:00:00.000Z" }),
    game("sec-ccg", "ALA", "UGA", "ALA", { championshipGame: true, date: "2026-12-05T17:00:00.000Z" }),
    game("mia-1", "MIA", "GT", "MIA"),
    game("clem-1", "CLEM", "GT", "CLEM"),
    game("clem-2", "CLEM", "FSU", "CLEM"),
    game("ala-1", "ALA", "UGA", "ALA"),
  ];
  const champs = autoBidTeams(TEAMS, games, cfp([["ALA", 4], ["CLEM", 12]]));
  assert.deepEqual(
    champs.map((row) => row.id),
    ["ALA", "CLEM"],
  );
});

test("at-large includes Notre Dame and CCG-out teams with 3 or fewer overall losses", () => {
  const games = [
    game("gt-1", "GT", "FSU", "GT"),
    game("gt-2", "GT", "CLEM", "CLEM"),
    game("gt-3", "GT", "MIA", "MIA"),
    game("fsu-1", "FSU", "CLEM", "CLEM"),
    game("fsu-2", "FSU", "MIA", "MIA"),
    game("fsu-3", "FSU", "ALA", "ALA"),
    game("fsu-4", "FSU", "UGA", "UGA"),
  ];
  const live = state({
    status: { GT: "eliminated", FSU: "eliminated", MIA: "destiny" },
  });
  const pool = atLargePoolTeams(TEAMS, live, cfp([["ND", 9], ["GT", 18]]), games);
  assert.deepEqual(
    pool.map((row) => row.id),
    ["ND", "GT"],
  );
});

test("at-large has no seven-team cap", () => {
  const extras = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"].map((id) =>
    team(id, ACC, id),
  );
  const games = extras.flatMap((row, index) => [
    game(`${row.id}-w`, row.id, "FSU", row.id, { week: index + 1 }),
  ]);
  const status = Object.fromEntries(extras.map((row) => [row.id, "eliminated" as const]));
  const ranks = extras.map((row, index) => [row.id, index + 1] as [string, number]);
  const pool = atLargePoolTeams(extras, state({ status }), cfp(ranks), games);
  assert.equal(pool.length, 8);
});

test("judgement eliminate drops a team from at-large", () => {
  const live = state();
  const next = eliminateFromAtLarge(live, "ND");
  const pool = atLargePoolTeams(TEAMS, next, cfp([["ND", 9]]), []);
  assert.equal(pool.some((row) => row.id === "ND"), false);
});

test("conference standings: destiny, then alive by losses then CFP, out-loss last", () => {
  const live = state({
    records: {
      MIA: { wins: 6, losses: 2 },
      CLEM: { wins: 7, losses: 1 },
      GT: { wins: 5, losses: 1 },
      FSU: { wins: 4, losses: 2 },
    },
    status: {
      MIA: "destiny",
      CLEM: "alive",
      GT: "out-loss",
      FSU: "alive",
    },
  });
  const tables = playoffTables(
    TEAMS,
    live,
    cfp([["CLEM", 8], ["FSU", 20], ["GT", 15], ["MIA", 3]]),
    [],
  );
  const acc = tables.find((table) => table.label === "ACC")!;
  assert.deepEqual(
    acc.standing.map((row) => row.id),
    ["MIA", "CLEM", "FSU", "GT"],
  );
});

test("eliminated conference teams sort by most recent knockout date", () => {
  const live = state({
    status: { GT: "eliminated", FSU: "eliminated" },
    playoffEliminatedIds: ["GT", "FSU"],
    eliminatedOn: { GT: "2026-10-18", FSU: "2026-11-01" },
  });
  const tables = playoffTables(TEAMS, live, cfp([]), []);
  const acc = tables.find((table) => table.label === "ACC")!;
  assert.deepEqual(
    acc.eliminated.map((row) => row.id),
    ["FSU", "GT"],
  );
});
