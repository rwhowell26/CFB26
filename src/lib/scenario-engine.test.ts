import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENARIO_CONFERENCES } from "./scenario-conferences.ts";
import { conferencesPresent, projectConference } from "./scenario-engine.ts";
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
    conferenceGroup: "Big 12 Conference",
  };
}

const BIG12 = SCENARIO_CONFERENCES.find((conf) => conf.id === "big12")!;
const ACC = SCENARIO_CONFERENCES.find((conf) => conf.id === "acc")!;
const AAC = SCENARIO_CONFERENCES.find((conf) => conf.id === "aac")!;
const TEAMS = ["UTAH", "BYU", "TECH", "HOU"].map((id) => team(id, "Big 12 Conference"));
const ACC_TEAMS = ["CLEM", "MIA", "FSU", "GT"].map((id) => team(id, "Atlantic Coast Conference"));
const AAC_TEAMS = ["NAVY", "TULN", "MEM", "USF", "FAU"].map((id) =>
  team(id, "American Conference"),
);

test("conference winning percentage / losses ranks a single table", () => {
  const games = [
    game("1", "UTAH", "HOU", "UTAH"),
    game("2", "UTAH", "TECH", "UTAH"),
    game("3", "BYU", "HOU", "BYU"),
    game("4", "TECH", "HOU", "TECH"),
  ];
  const result = projectConference(BIG12, TEAMS, games);
  assert.equal(result.tables[0].rows[0].teamId, "UTAH");
  assert.equal(result.championship.homeId, "UTAH");
  assert.equal(result.championship.awayId, "BYU");
});

test("two-team head-to-head breaks an ACC tie at the same percentage", () => {
  const games = [
    game("1", "CLEM", "MIA", "MIA"),
    game("2", "CLEM", "FSU", "CLEM"),
    game("3", "MIA", "FSU", "MIA"),
    game("4", "CLEM", "GT", "CLEM"),
    game("5", "MIA", "GT", "GT"),
  ];
  const result = projectConference(ACC, ACC_TEAMS, games);
  assert.equal(result.tables[0].rows[0].conf.wins, 2);
  assert.equal(result.tables[0].rows[0].conf.losses, 1);
  assert.equal(result.tables[0].rows[0].teamId, "MIA");
  assert.equal(result.tables[0].rows[1].teamId, "CLEM");
  assert.equal(result.tables[0].rows[0].place, 1);
  assert.equal(result.tables[0].rows[1].place, 2);
});

test("a remaining-game pick changes the projected champion", () => {
  const games = [
    game("1", "UTAH", "HOU", "UTAH"),
    game("2", "BYU", "TECH", "BYU"),
    game("3", "UTAH", "BYU", null, 8),
  ];
  const before = projectConference(BIG12, TEAMS, games);
  const after = projectConference(BIG12, TEAMS, games, { picks: { "3": "BYU" } });
  assert.equal(before.unpickedCount, 1);
  assert.equal(after.unpickedCount, 0);
  assert.equal(after.tables[0].rows[0].teamId, "BYU");
});

test("unresolved blended computer rankings use competition places 2-2-2 then 5", () => {
  const games = [
    game("1", "NAVY", "TULN", "NAVY"),
    game("2", "NAVY", "MEM", "NAVY"),
    game("3", "NAVY", "USF", "NAVY"),
    game("4", "TULN", "FAU", "TULN"),
    game("5", "MEM", "FAU", "MEM"),
    game("6", "USF", "FAU", "USF"),
  ];
  const result = projectConference(AAC, AAC_TEAMS, games);
  const rows = result.tables[0].rows;
  assert.equal(rows[0].teamId, "NAVY");
  assert.equal(rows[0].place, 1);
  assert.equal(rows[0].unresolved, false);
  assert.deepEqual(
    rows.slice(1, 4).map((row) => row.teamId),
    ["MEM", "TULN", "USF"],
  );
  assert.deepEqual(
    rows.slice(1, 4).map((row) => row.place),
    [2, 2, 2],
  );
  assert.ok(rows.slice(1, 4).every((row) => row.unresolved));
  assert.equal(rows[4].teamId, "FAU");
  assert.equal(rows[4].place, 5);
  assert.match(result.championship.note, /tied at #2 on blended computer rankings/i);
});

test("independents are omitted from the Scenarios conference list", () => {
  const teams = [
    team("ND", "FBS Independents"),
    team("UCONN", "FBS Independents"),
    ...TEAMS,
  ];
  assert.deepEqual(
    conferencesPresent(teams).map((conf) => conf.id),
    ["big12"],
  );
});

test("Sun Belt still uses East/West division tables", () => {
  const sunbelt = SCENARIO_CONFERENCES.find((conf) => conf.id === "sunbelt")!;
  const teams = [
    team("256", "Sun Belt - East"),
    team("2348", "Sun Belt - West"),
  ];
  const result = projectConference(sunbelt, teams, []);
  assert.deepEqual(
    result.tables.map((table) => table.id),
    ["east", "west"],
  );
});
