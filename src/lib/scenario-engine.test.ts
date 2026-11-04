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

test("ACC 5-4 and 4-4 with unequal games share a SportSource CCG tie", () => {
  const teams = ["MIA", "PITT", "BC", "FSU", "GT", "SMU"].map((id) =>
    team(id, "Atlantic Coast Conference"),
  );
  const games = [
    game("m1", "MIA", "PITT", "MIA"),
    game("m2", "MIA", "FSU", "MIA"),
    game("m3", "MIA", "GT", "MIA"),
    game("m4", "MIA", "SMU", "MIA"),
    game("m5", "MIA", "BC", "MIA"),
    game("p1", "PITT", "FSU", "PITT"),
    game("p2", "PITT", "GT", "PITT"),
    game("p3", "PITT", "SMU", "SMU"),
    game("b1", "BC", "FSU", "BC"),
    game("b2", "BC", "GT", "GT"),
  ];
  const result = projectConference(ACC, teams, games);
  const rows = result.tables[0].rows;
  const pitt = rows.find((row) => row.teamId === "PITT");
  const bc = rows.find((row) => row.teamId === "BC");
  assert.equal(pitt?.conf.wins, 2);
  assert.equal(pitt?.conf.losses, 2);
  assert.equal(bc?.conf.wins, 1);
  assert.equal(bc?.conf.losses, 2);
  assert.equal(rows[0]?.teamId, "MIA");
  assert.equal(rows[0]?.place, 1);
  assert.equal(pitt?.place, 2);
  assert.equal(bc?.place, 2);
  assert.equal(pitt?.unresolved, true);
  assert.equal(bc?.unresolved, true);
});

test("two-team head-to-head breaks an ACC tie at the same percentage", () => {
  const games = [
    game("1", "CLEM", "MIA", "MIA"),
    game("2", "CLEM", "FSU", "CLEM"),
    game("3", "MIA", "FSU", "MIA"),
    game("4", "CLEM", "GT", "CLEM"),
    game("5", "MIA", "GT", "GT"),
    game("6", "GT", "FSU", "FSU"),
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

test("only the ACC uses 8-game vs 9-game same-wins-or-losses attach", () => {
  assert.deepEqual(
    SCENARIO_CONFERENCES.filter((conf) => conf.initialRank === "percentage-advantage").map(
      (conf) => conf.id,
    ),
    ["acc"],
  );
});

test("non-ACC percentage ranking keeps 5-4 ahead of 4-4", () => {
  const ids = ["MIA", "NAVY", "TULN", "W1", "W2", "W3", "W4", "L1", "L2", "L3"];
  const aacTeams = ids.map((id) => team(id, "American Conference"));
  const games = [
    game("m-navy", "MIA", "NAVY", "MIA"),
    game("m-tuln", "MIA", "TULN", "MIA"),
    game("m-l1", "MIA", "L1", "MIA"),
    game("m-l2", "MIA", "L2", "MIA"),
    game("m-l3", "MIA", "L3", "MIA"),
    game("n-tuln", "NAVY", "TULN", "NAVY"),
    game("n-w1", "NAVY", "W1", "NAVY"),
    game("n-w2", "NAVY", "W2", "NAVY"),
    game("n-w3", "NAVY", "W3", "NAVY"),
    game("n-w4", "NAVY", "W4", "NAVY"),
    game("n-l1", "NAVY", "L1", "L1"),
    game("n-l2", "NAVY", "L2", "L2"),
    game("n-l3", "NAVY", "L3", "L3"),
    game("t-w1", "TULN", "W1", "TULN"),
    game("t-w2", "TULN", "W2", "TULN"),
    game("t-w3", "TULN", "W3", "TULN"),
    game("t-w4", "TULN", "W4", "TULN"),
    game("t-l1", "TULN", "L1", "L1"),
    game("t-l2", "TULN", "L2", "L2"),
  ];
  const aac = projectConference(AAC, aacTeams, games);
  const navy = aac.tables[0].rows.find((row) => row.teamId === "NAVY");
  const tuln = aac.tables[0].rows.find((row) => row.teamId === "TULN");
  assert.equal(navy?.conf.wins, 5);
  assert.equal(navy?.conf.losses, 4);
  assert.equal(tuln?.conf.wins, 4);
  assert.equal(tuln?.conf.losses, 4);
  assert.ok((navy?.place ?? 99) < (tuln?.place ?? 99));
});
