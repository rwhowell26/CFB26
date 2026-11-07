import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENARIO_CONFERENCES } from "./scenario-conferences.ts";
import { projectConference } from "./scenario-engine.ts";
import {
  conferenceContention,
  eliminationGamesThisWeek,
  gameImplications,
  proofPicksCopy,
  scenarioProofPicks,
  weekSwingsThisWeek,
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
const ACC = SCENARIO_CONFERENCES.find((conf) => conf.id === "acc")!;
const SEC = SCENARIO_CONFERENCES.find((conf) => conf.id === "sec")!;
const SEC_TEAMS = ["MIZ", "UGA", "BAMA", "UK", "VAN", "AUB"].map((id) =>
  team(id, "Southeastern Conference"),
);
const TEAMS = ["NAVY", "TULN", "MEM", "USF", "FAU"].map((id) =>
  team(id, "American Conference"),
);
const ACC_TEAMS = ["MIA", "WAKE", "CLEM", "PITT", "FSU", "DUKE", "SMU", "GT", "BC", "NCST"].map(
  (id) => team(id, "Atlantic Coast Conference"),
);

function acc(
  id: string,
  home: string,
  away: string,
  winner: string | null,
  week = 1,
): Game {
  return game(id, home, away, winner, week, "Atlantic Coast Conference");
}

test("a team that must win this week to keep a CCG path is out with a loss", () => {
  // MEM 1-1, remaining vs FAU. NAVY is 3-0 with no games left; TULN is 1-0
  // with a leftover vs USF. MEM can catch 2nd only if they win and TULN loses,
  // so a next-game loss eliminates them and winning out is not destiny.
  const games = [
    game("1", "NAVY", "USF", "NAVY"),
    game("2", "NAVY", "FAU", "NAVY"),
    game("3", "NAVY", "MEM", "NAVY"),
    game("4", "TULN", "FAU", "TULN"),
    game("5", "MEM", "USF", "MEM"),
    game("6", "MEM", "FAU", null, 8),
    game("7", "TULN", "USF", null, 8),
  ];
  const result = conferenceContention(AAC, TEAMS, games, { week: 8 });
  assert.equal(result.byTeam.get("MEM")?.status, "out-loss");
  assert.equal(result.byTeam.get("MEM")?.survivesNextLoss, false);
  assert.equal(result.byTeam.get("MEM")?.clinchesWinOut, false);
  assert.equal(result.byTeam.get("FAU")?.status, "eliminated");
  assert.equal(result.byTeam.get("NAVY")?.hasPath, true);
  assert.equal(result.byTeam.get("TULN")?.hasPath, true);
  const memElim = eliminationGamesThisWeek(AAC, "MEM", TEAMS, games, { week: 8 });
  assert.ok(
    memElim.some(
      (item) =>
        item.game.id === "6" &&
        item.eliminatesIf.winnerId === "FAU" &&
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

test("winning out into an unresolved computer tie is destiny", () => {
  const games = [
    game("1", "NAVY", "FAU", "NAVY"),
    game("2", "NAVY", "USF", "NAVY"),
    game("3", "TULN", "FAU", "TULN"),
    game("4", "TULN", "USF", "TULN"),
    game("5", "MEM", "FAU", "MEM"),
    game("6", "MEM", "USF", "MEM"),
    game("7", "NAVY", "FAU", null, 8),
    game("8", "TULN", "USF", null, 8),
    game("9", "MEM", "FAU", null, 8),
  ];
  const result = conferenceContention(AAC, TEAMS, games, { week: 8 });
  assert.equal(result.byTeam.get("NAVY")?.hasPath, true);
  assert.equal(result.byTeam.get("NAVY")?.clinchesWinOut, true);
  assert.equal(result.byTeam.get("NAVY")?.clinchesThisWin, false);
  assert.equal(result.byTeam.get("NAVY")?.status, "destiny");
  assert.equal(result.byTeam.get("TULN")?.status, "destiny");
  assert.equal(result.byTeam.get("MEM")?.status, "destiny");
});

test("a top-two chaser still has a path when current occupants can lose remaining games", () => {
  const games = [
    game("1", "NAVY", "FAU", "NAVY"),
    game("2", "NAVY", "USF", "NAVY"),
    game("3", "NAVY", "MEM", "NAVY"),
    game("4", "TULN", "FAU", "TULN"),
    game("5", "TULN", "USF", "TULN"),
    game("6", "MEM", "FAU", "MEM"),
    game("7", "MEM", "USF", "MEM"),
    game("8", "NAVY", "TULN", null, 8),
    game("9", "MEM", "TULN", null, 8),
    game("10", "MEM", "FAU", null, 8),
  ];
  const result = conferenceContention(AAC, TEAMS, games, { week: 8 });
  assert.equal(result.byTeam.get("MEM")?.hasPath, true);
  assert.notEqual(result.byTeam.get("MEM")?.status, "eliminated");
  assert.equal(result.byTeam.get("NAVY")?.clinchesWinOut, true);
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

test("winning out is not destiny when two other 3-1s dump them on SEC common opponents", () => {
  function sec(
    id: string,
    home: string,
    away: string,
    winner: string | null,
    week = 1,
  ): Game {
    return game(id, home, away, winner, week, "Southeastern Conference");
  }
  const games = [
    sec("uga-bama", "UGA", "BAMA", "UGA"),
    sec("uga-van", "UGA", "VAN", "UGA"),
    sec("uga-aub", "UGA", "AUB", "UGA"),
    sec("bama-van", "BAMA", "VAN", "BAMA"),
    sec("bama-aub", "BAMA", "AUB", "BAMA"),
    sec("miz-van", "MIZ", "VAN", "VAN"),
    sec("miz-aub", "MIZ", "AUB", "MIZ"),
    sec("uk-van", "UK", "VAN", "UK"),
    sec("uk-aub", "UK", "AUB", "UK"),
    sec("miz-uga", "MIZ", "UGA", null, 8),
    sec("miz-uk", "UK", "MIZ", null, 8),
    sec("bama-uk", "BAMA", "UK", null, 8),
  ];
  const result = conferenceContention(SEC, SEC_TEAMS, games, { week: 8 });
  assert.equal(result.byTeam.get("MIZ")?.hasPath, true);
  assert.equal(result.byTeam.get("MIZ")?.clinchesWinOut, false);
  assert.notEqual(result.byTeam.get("MIZ")?.status, "destiny");
  assert.ok(
    result.byTeam.get("UGA")?.status === "destiny" || result.byTeam.get("UGA")?.status === "clinch",
  );
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

test("a next-game loss into an unresolved SportSource tie is alive, not out with a loss", () => {
  // ACC ranks by percentage, then H2H, then SportSource. PITT 1-1 loses next vs FSU
  // and wins the rest → 2-2. SMU is already 2-2 with no leftovers, and they never
  // played, so SportSource leaves them tied at #2 behind MIA.
  // Win-count dump would hand CLEM (1-0) a leftover win to "match" PITT's 2 wins and
  // steal 2nd on percentage (2-0). Percentage dump keeps CLEM from jumping; an
  // undetermined SportSource pile still counts as a CCG path.
  const games = [
    acc("m1", "MIA", "FSU", "MIA"),
    acc("m2", "MIA", "GT", "MIA"),
    acc("m4", "MIA", "PITT", "MIA"),
    acc("m5", "MIA", "SMU", "MIA"),
    acc("w1", "WAKE", "FSU", "WAKE"),
    acc("w2", "WAKE", "GT", "WAKE"),
    acc("c1", "CLEM", "GT", "CLEM"),
    acc("p1", "PITT", "GT", "PITT"),
    acc("s1", "SMU", "FSU", "SMU"),
    acc("s2", "SMU", "GT", "SMU"),
    acc("s4", "DUKE", "SMU", "DUKE"),
    acc("next", "PITT", "FSU", null, 8),
    acc("p2", "PITT", "WAKE", null, 9),
    acc("w3", "WAKE", "GT", null, 9),
    acc("c2", "CLEM", "DUKE", null, 8),
    acc("m6", "MIA", "DUKE", null, 9),
    acc("d2", "DUKE", "FSU", null, 9),
  ];
  const result = conferenceContention(ACC, ACC_TEAMS, games, { week: 8 });
  const pitt = result.byTeam.get("PITT");
  assert.equal(pitt?.hasPath, true);
  assert.equal(pitt?.survivesNextLoss, true);
  assert.equal(pitt?.status, "alive");
  const picks = scenarioProofPicks(ACC, ACC_TEAMS, games, "PITT", { week: 8 });
  assert.equal(picks["next"], "FSU");
  assert.equal(picks["p2"], "PITT");
  const projected = projectConference(ACC, ACC_TEAMS, games, { picks });
  const pittRow = projected.tables[0].rows.find((row) => row.teamId === "PITT");
  assert.ok(pittRow);
  assert.ok((pittRow!.place ?? 99) <= 2);
  assert.equal(pittRow!.unresolved, true);
});

test("an 8-game ACC team that loses next into a 4-loss SportSource pile is alive", () => {
  // BC 0-1 loses next vs FSU and beats GT → 1-2. PITT is already 2-2. Unequal
  // games, same 2 losses, so ACC pulls BC into PITT's SportSource group at #2
  // behind MIA. Percentage-only grouping left BC at #3 and called them out-loss.
  const games = [
    acc("m1", "MIA", "PITT", "MIA"),
    acc("m2", "MIA", "FSU", "MIA"),
    acc("m3", "MIA", "GT", "MIA"),
    acc("m4", "MIA", "SMU", "MIA"),
    acc("m5", "MIA", "BC", "MIA"),
    acc("p1", "PITT", "FSU", "PITT"),
    acc("p2", "PITT", "GT", "PITT"),
    acc("p3", "PITT", "SMU", "SMU"),
    acc("next", "BC", "FSU", null, 8),
    acc("b2", "BC", "GT", null, 9),
  ];
  const result = conferenceContention(ACC, ACC_TEAMS, games, { week: 8 });
  const bc = result.byTeam.get("BC");
  assert.equal(bc?.hasPath, true);
  assert.equal(bc?.survivesNextLoss, true);
  assert.notEqual(bc?.status, "out-loss");
  const projected = projectConference(ACC, ACC_TEAMS, games, {
    picks: { next: "FSU", b2: "BC" },
  });
  const bcRow = projected.tables[0].rows.find((row) => row.teamId === "BC");
  const pittRow = projected.tables[0].rows.find((row) => row.teamId === "PITT");
  assert.equal(bcRow?.conf.wins, 1);
  assert.equal(bcRow?.conf.losses, 2);
  assert.equal(pittRow?.conf.wins, 2);
  assert.equal(pittRow?.conf.losses, 2);
  assert.ok((bcRow?.place ?? 99) <= 2);
  assert.equal(bcRow?.unresolved, true);
  assert.equal(pittRow?.place, bcRow?.place);
  const swings = weekSwingsThisWeek(ACC, "BC", ACC_TEAMS, games, { week: 8 });
  assert.equal(
    swings.some((item) => item.kind === "eliminates" && item.winnerId === "FSU"),
    false,
  );
});

test("a next-game loss into a 4-loss SportSource pile is alive even if dump leaves extra leaders", () => {
  // NCST 0-1 loses next vs DUKE and beats GT → 1-2. PITT is 2-2. Same two losses,
  // unequal games → SportSource group at #2 behind MIA, unless leftover WAKE/CLEM
  // is dumped onto WAKE (2-0 → 3-0) to share 1.000 with MIA and push NCST to #3.
  const games = [
    acc("m1", "MIA", "PITT", "MIA"),
    acc("m2", "MIA", "FSU", "MIA"),
    acc("m3", "MIA", "GT", "MIA"),
    acc("m4", "MIA", "SMU", "MIA"),
    acc("m5", "MIA", "NCST", "MIA"),
    acc("m6", "MIA", "CLEM", "MIA"),
    acc("w1", "WAKE", "FSU", "WAKE"),
    acc("w2", "WAKE", "GT", "WAKE"),
    acc("p1", "PITT", "FSU", "PITT"),
    acc("p2", "PITT", "GT", "PITT"),
    acc("p3", "PITT", "SMU", "SMU"),
    acc("next", "NCST", "DUKE", null, 8),
    acc("n2", "NCST", "GT", null, 9),
    acc("left", "WAKE", "CLEM", null, 9),
  ];
  const result = conferenceContention(ACC, ACC_TEAMS, games, { week: 8 });
  const ncst = result.byTeam.get("NCST");
  assert.equal(ncst?.hasPath, true);
  assert.equal(ncst?.survivesNextLoss, true);
  assert.equal(ncst?.status, "alive");
  const picks = scenarioProofPicks(ACC, ACC_TEAMS, games, "NCST", { week: 8 });
  assert.equal(picks["next"], "DUKE");
  assert.equal(picks["n2"], "NCST");
  const projected = projectConference(ACC, ACC_TEAMS, games, { picks });
  const row = projected.tables[0].rows.find((item) => item.teamId === "NCST");
  assert.ok((row?.place ?? 99) <= 2);
  assert.equal(row?.unresolved, true);
});

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

test("proof picks win out and spoil others for destiny", () => {
  const games = [
    game("1", "NAVY", "USF", "NAVY"),
    game("2", "TULN", "FAU", "TULN"),
    game("3", "TULN", "USF", "TULN"),
    game("4", "MEM", "FAU", "MEM"),
    game("5", "NAVY", "FAU", null, 8),
    game("6", "NAVY", "TULN", null, 9),
    game("7", "NAVY", "MEM", null, 9),
  ];
  const picks = scenarioProofPicks(AAC, TEAMS, games, "NAVY", { week: 8 });
  assert.equal(picks["5"], "NAVY");
  assert.equal(picks["6"], "NAVY");
  assert.equal(picks["7"], "NAVY");
  const projected = projectConference(AAC, TEAMS, games, { picks });
  const navy = projected.tables[0].rows.find((row) => row.teamId === "NAVY");
  assert.ok(navy);
  assert.ok(navy!.place <= 2);
  assert.ok(
    projected.championship.homeId === "NAVY" || projected.championship.awayId === "NAVY",
  );
});

test("proof picks lose next then help others for out-with-a-loss still missing the CCG", () => {
  const games = [
    game("1", "NAVY", "USF", "NAVY"),
    game("2", "NAVY", "FAU", "NAVY"),
    game("3", "NAVY", "MEM", "NAVY"),
    game("4", "TULN", "FAU", "TULN"),
    game("5", "MEM", "USF", "MEM"),
    game("6", "MEM", "FAU", null, 8),
    game("7", "TULN", "USF", null, 8),
  ];
  const mem = conferenceContention(AAC, TEAMS, games, { week: 8 }).byTeam.get("MEM");
  assert.equal(mem?.status, "out-loss");
  const picks = scenarioProofPicks(AAC, TEAMS, games, "MEM", { week: 8 });
  assert.equal(picks["6"], "FAU");
  assert.equal(picks["7"], "USF");
  const projected = projectConference(AAC, TEAMS, games, { picks });
  const memRow = projected.tables[0].rows.find((row) => row.teamId === "MEM");
  assert.ok(memRow);
  assert.ok(memRow!.place > 2);
  assert.notEqual(projected.championship.homeId, "MEM");
  assert.notEqual(projected.championship.awayId, "MEM");
  assert.match(proofPicksCopy("out-loss", "MEM"), /best case/);
  assert.match(proofPicksCopy("out-loss", "MEM"), /misses the CCG/);
});

test("proof picks lose next then help others so an alive team still finishes first", () => {
  const next = sbc("next", APP, GSU, null, 10);
  const appGames = [
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
  const app = conferenceContention(SBC, SBC_TEAMS, appGames, { week: 10 }).byTeam.get(APP);
  assert.equal(app?.status, "alive");
  const appPicks = scenarioProofPicks(SBC, SBC_TEAMS, appGames, APP, { week: 10 });
  assert.equal(appPicks["next"], GSU);
  assert.equal(appPicks["ar1"], APP);
  assert.equal(appPicks["ar2"], APP);
  assert.equal(appPicks["ar3"], APP);
  const projected = projectConference(SBC, SBC_TEAMS, appGames, { picks: appPicks });
  const east = projected.tables.find((table) => table.id === "east");
  const appRow = east?.rows.find((row) => row.teamId === APP);
  assert.equal(appRow?.place, 1);
  assert.equal(east?.rows.filter((row) => row.place === 1).length, 1);
  assert.ok(
    projected.championship.homeId === APP || projected.championship.awayId === APP,
  );
});

test("proof picks win out with help for an eliminated team still missing the CCG", () => {
  const games = [
    game("1", "NAVY", "USF", "NAVY"),
    game("2", "NAVY", "FAU", "NAVY"),
    game("3", "TULN", "USF", "TULN"),
    game("4", "TULN", "FAU", "TULN"),
    game("5", "MEM", "FAU", "MEM"),
    game("6", "MEM", "USF", null, 8),
    game("7", "FAU", "USF", null, 9),
  ];
  const result = conferenceContention(AAC, TEAMS, games, { week: 8 });
  assert.equal(result.byTeam.get("FAU")?.status, "eliminated");
  const picks = scenarioProofPicks(AAC, TEAMS, games, "FAU", { week: 8 });
  assert.equal(picks["7"], "FAU");
  const projected = projectConference(AAC, TEAMS, games, { picks });
  const fau = projected.tables[0].rows.find((row) => row.teamId === "FAU");
  assert.ok(fau);
  assert.ok(fau!.place > 2);
  assert.notEqual(projected.championship.homeId, "FAU");
  assert.notEqual(projected.championship.awayId, "FAU");
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
