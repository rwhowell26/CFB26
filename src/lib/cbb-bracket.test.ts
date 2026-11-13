import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignField,
  bestTeamByConference,
  fieldResultsForTeam,
  liveReserveCounts,
  markPlayIn,
  padAboveSlots,
  recommendNewTeams,
  remainingAutoBidIds,
  seedForFieldIndex,
  seedLinePlayInGames,
  seedLinePlayInTeams,
  seedLineSize,
  seedWorkingPool,
  spotForTeam,
  spotFromRank,
  spotLabel,
  teamsAboveCurrent,
} from "./cbb-bracket";
import { emptyMetrics } from "./cbb-metrics";
import {
  COMPLETED_ABOVE,
  FIELD_SIZE,
  PLAY_IN_GAMES,
  PLAY_IN_TEAMS,
  SEED_LINE_SPOTS,
} from "./cbb-season";
import type { CbbFieldTeam, CbbSnapshot, CbbTeam, CbbTeamMetrics } from "./cbb-types";

function team(
  id: string,
  conference: string,
  wins = 10,
  losses = 2,
): CbbTeam {
  return {
    id,
    name: id,
    shortName: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    conference,
    logo: null,
    color: null,
    alternateColor: null,
    wins,
    losses,
  };
}

function rankedMetrics(ids: string[]): Map<string, CbbTeamMetrics> {
  const map = new Map<string, CbbTeamMetrics>();
  ids.forEach((id, index) => {
    const rank = index + 1;
    map.set(id, {
      ...emptyMetrics(id),
      sor: rank,
      kpi: rank,
      wab: rank,
      kenpom: rank,
      bpi: rank,
      torvik: rank,
    });
  });
  return map;
}

test("assignField stops at-larges so remaining conferences still fit", () => {
  const conferences = ["A", "B", "C", "D"];
  const teams = [
    team("a1", "A"),
    team("a2", "A"),
    team("a3", "A"),
    team("b1", "B"),
    team("c1", "C"),
    team("d1", "D"),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map([
    ["A", "a1"],
    ["B", "b1"],
    ["C", "c1"],
    ["D", "d1"],
  ]);

  const result = assignField(
    ["a1", "a2", "a3", "b1", "c1", "d1"],
    teamsById,
    conferences,
    best,
    6,
  );

  assert.equal(result.field.length, 6);
  assert.deepEqual(result.atLargeIds, ["a1", "a2", "a3"]);
  assert.equal(result.autoBidsReserved, 3);
  assert.equal(result.autoBidsTotal, 4);
  assert.deepEqual(result.autoBidByConference, {
    A: "a1",
    B: "b1",
    C: "c1",
    D: "d1",
  });
  assert.equal(result.unrepresented.length, 0);
});

test("assignField skips extra at-larges when only auto-bid slots remain", () => {
  const conferences = Array.from({ length: 4 }, (_, i) => `C${i}`);
  const power = Array.from({ length: 10 }, (_, i) => team(`p${i}`, "C0"));
  const autos = conferences.slice(1).map((conf) => team(`${conf}-best`, conf, 8, 8));
  const teams = [...power, ...autos];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map(conferences.map((conf, i) => [conf, i === 0 ? "p0" : `${conf}-best`]));
  const sCurve = [...power.map((item) => item.id), ...autos.map((item) => item.id)];

  const result = assignField(sCurve, teamsById, conferences, best, 6);
  assert.equal(result.field.length, 6);
  assert.ok(result.atLargeIds.includes("p0"));
  assert.equal(result.atLargeIds.length, 3);
  assert.equal(result.autoBidsReserved, 3);
  assert.equal(result.autoBidsTotal, 4);
  assert.equal(Object.keys(result.autoBidByConference).length, 4);
  assert.ok(!result.atLargeIds.includes("p9"));
  assert.ok(result.firstFourOut.includes("p3"));
});

test("live reserve counts start at 32/32 and drop after a conference champ is placed", () => {
  const conferences = Array.from({ length: 32 }, (_, i) => `C${i}`);
  const teams = [
    team("florida", "C0"),
    team("msu", "C1"),
    ...conferences.slice(2).map((conf) => team(`${conf}-best`, conf)),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map(conferences.map((conf, i) => [conf, i === 0 ? "florida" : i === 1 ? "msu" : `${conf}-best`]));
  const start = liveReserveCounts([], teamsById, best, conferences);
  assert.equal(start.reserved, 32);
  assert.equal(start.atLargeSpots, 44);
  assert.equal(start.playInRemaining, 24);
  const afterFlorida = liveReserveCounts(["florida"], teamsById, best, conferences);
  assert.equal(afterFlorida.reserved, 31);
  assert.equal(afterFlorida.atLargeSpots, 45);
  assert.equal(afterFlorida.playInRemaining, 23);
});

test("a merit auto-bid joins the at-large group and drops reserved spots", () => {
  const conferences = Array.from({ length: 32 }, (_, i) => `C${i}`);
  const power = Array.from({ length: 50 }, (_, i) => team(`p${i}`, "C0"));
  const autos = conferences.slice(1).map((conf) => team(`${conf}-best`, conf, 8, 8));
  const teams = [...power, ...autos];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map(conferences.map((conf, i) => [conf, i === 0 ? "p0" : `${conf}-best`]));
  const sCurve = [...power.map((item) => item.id), ...autos.map((item) => item.id)];
  const result = assignField(sCurve, teamsById, conferences, best);
  assert.equal(result.autoBidsTotal, 32);
  assert.equal(result.autoBidsReserved, 31);
  assert.equal(result.atLargeIds.length, 45);
  assert.ok(result.atLargeIds.includes("p0"));
  assert.equal(result.autoBidByConference.C0, "p0");
  assert.ok(result.firstFourOut.includes("p45"));
});

test("recommendNewTeams keeps teams within 15 of the last Next 4 Out", () => {
  const teams = [
    team("in1", "A"),
    team("bubble8", "B"),
    team("newClose", "C"),
    team("newFar", "D"),
  ];
  const metrics = rankedMetrics(["in1", "bubble8", "newClose", "newFar"]);
  metrics.set("bubble8", { ...emptyMetrics("bubble8"), sor: 20, kpi: 20, wab: 20 });
  metrics.set("newClose", { ...emptyMetrics("newClose"), sor: 34, kpi: 34, wab: 34 });
  metrics.set("newFar", { ...emptyMetrics("newFar"), sor: 50, kpi: 50, wab: 50 });
  const previous: CbbSnapshot = {
    id: "prev",
    createdAt: "2026-11-01T00:00:00.000Z",
    label: "prev",
    sCurve: ["in1", "bubble8"],
    atLargeIds: ["in1"],
    autoBidByConference: {},
    firstFourOut: [],
    nextFourOut: ["bubble8"],
    recommendedIds: [],
  };
  const recs = recommendNewTeams(teams, metrics, previous);
  assert.deepEqual(recs, ["newClose"]);
});

test("recommendNewTeams still considers a former auto-bid with bubble numbers", () => {
  const teams = [
    team("in1", "A"),
    team("bubble8", "B"),
    team("grandcanyon", "WAC"),
    team("utarlington", "WAC"),
  ];
  const metrics = rankedMetrics(["in1", "bubble8", "grandcanyon", "utarlington"]);
  metrics.set("bubble8", { ...emptyMetrics("bubble8"), sor: 40, kpi: 40, wab: 40 });
  metrics.set("grandcanyon", { ...emptyMetrics("grandcanyon"), sor: 48, kpi: 48, wab: 48 });
  const previous: CbbSnapshot = {
    id: "prev",
    createdAt: "2026-11-01T00:00:00.000Z",
    label: "prev",
    sCurve: ["in1", "bubble8", "grandcanyon"],
    atLargeIds: ["in1"],
    autoBidByConference: { WAC: "grandcanyon" },
    firstFourOut: [],
    nextFourOut: ["bubble8"],
    recommendedIds: [],
  };
  const recs = recommendNewTeams(teams, metrics, previous);
  assert.ok(recs.includes("grandcanyon"));
});

test("seedWorkingPool keeps last at-larges and leaves AQ-only teams for the auto-bid pass", () => {
  const teams = [team("duke", "ACC"), team("unc", "ACC"), team("iowa", "MVC", 9, 3)];
  const metrics = rankedMetrics(["duke", "unc", "iowa"]);
  const previous: CbbSnapshot = {
    id: "prev",
    createdAt: "2026-11-01T00:00:00.000Z",
    label: "prev",
    sCurve: ["unc", "duke"],
    atLargeIds: ["unc", "duke"],
    autoBidByConference: { ACC: "duke" },
    firstFourOut: [],
    nextFourOut: [],
    recommendedIds: [],
  };
  const pool = seedWorkingPool(teams, metrics, previous, ["ACC", "MVC"]);
  assert.ok(pool.includes("unc"));
  assert.ok(pool.includes("duke"));
  assert.ok(!pool.includes("iowa"));
  assert.deepEqual(remainingAutoBidIds(pool, teams, metrics, ["ACC", "MVC"], previous), ["iowa"]);
});

test("first board seeds by current six-rank average, lowest first", () => {
  const teams = [team("low", "A"), team("high", "B"), team("mid", "C")];
  const metrics = new Map<string, CbbTeamMetrics>([
    ["low", { ...emptyMetrics("low"), kenpom: 4, bpi: 4, torvik: 4, sor: 4, kpi: 4, wab: 4 }],
    ["mid", { ...emptyMetrics("mid"), kenpom: 12, bpi: 12, torvik: 12, sor: 12, kpi: 12, wab: 12 }],
    ["high", { ...emptyMetrics("high"), kenpom: 20, bpi: 20, torvik: 20, sor: 20, kpi: 20, wab: 20 }],
  ]);
  assert.deepEqual(seedWorkingPool(teams, metrics, null), ["low", "mid", "high"]);
});

test("auto-bid is the current best (lowest) rank average in that conference", () => {
  const teams = [team("unc", "ACC"), team("duke", "ACC"), team("iowa", "MVC")];
  const metrics = new Map<string, CbbTeamMetrics>([
    ["unc", { ...emptyMetrics("unc"), kenpom: 18 }],
    ["duke", { ...emptyMetrics("duke"), kenpom: 31 }],
    ["iowa", { ...emptyMetrics("iowa"), kenpom: 9 }],
  ]);
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = bestTeamByConference(teams, teamsById, metrics);
  assert.equal(best.get("ACC"), "unc");
  assert.equal(best.get("MVC"), "iowa");
});

test("first at-large board omits AQ-only conference leaders below the cut", () => {
  const power = Array.from({ length: 80 }, (_, i) => team(`p${i}`, "Power"));
  const mid = team("mid", "MVC");
  const teams = [...power, mid];
  const metrics = new Map<string, CbbTeamMetrics>();
  for (const item of power) {
    const rank = Number(item.id.slice(1)) + 1;
    metrics.set(item.id, { ...emptyMetrics(item.id), kenpom: rank });
  }
  metrics.set("mid", { ...emptyMetrics("mid"), kenpom: 200 });
  const conferences = ["Power", "MVC"];
  const pool = seedWorkingPool(teams, metrics, null, conferences);
  assert.ok(!pool.includes("mid"));
  assert.equal(pool[0], "p0");
  assert.ok(pool.length >= FIELD_SIZE - 1 + 4);
  assert.deepEqual(remainingAutoBidIds(pool, teams, metrics, conferences), ["mid"]);
});

test("a former conference leader stays on the at-large board", () => {
  const teams = [
    team("grandcanyon", "WAC"),
    team("utarlington", "WAC"),
    team("unc", "ACC"),
    team("iowa", "MVC"),
  ];
  const metrics = rankedMetrics(["unc", "grandcanyon", "utarlington", "iowa"]);
  const previous: CbbSnapshot = {
    id: "prev",
    createdAt: "2026-11-01T00:00:00.000Z",
    label: "prev",
    sCurve: ["unc", "grandcanyon", "iowa"],
    atLargeIds: ["unc", "grandcanyon"],
    autoBidByConference: { WAC: "grandcanyon", ACC: "unc", MVC: "iowa" },
    firstFourOut: [],
    nextFourOut: [],
    recommendedIds: [],
  };
  const pool = seedWorkingPool(teams, metrics, previous, ["WAC", "ACC", "MVC"]);
  assert.ok(pool.includes("grandcanyon"));
  assert.ok(pool.includes("unc"));
});

test("teams past Next 4 Out are Currently out, not a seed line", () => {
  const conferences = ["C0"];
  const power = Array.from({ length: 16 }, (_, i) => team(`p${i}`, "C0"));
  const teamsById = new Map(power.map((item) => [item.id, item]));
  const sCurve = power.map((item) => item.id);
  const result = assignField(sCurve, teamsById, conferences, new Map([["C0", "p0"]]), 6);
  assert.equal(result.nextFourOut.length, 4);
  const leftover = "p14";
  assert.ok(!result.field.some((row) => row.teamId === leftover));
  assert.ok(!result.firstFourOut.includes(leftover));
  assert.ok(!result.nextFourOut.includes(leftover));
  const spot = spotForTeam(leftover, sCurve, result);
  assert.equal(spot.band, "out");
  assert.equal(spot.seed, null);
  assert.equal(spotLabel(spot), "Currently out");
});

test("at-larges past the auto-bid reservation are First 4 Out, not 14-seeds", () => {
  const conferences = Array.from({ length: 4 }, (_, i) => `C${i}`);
  const power = Array.from({ length: 10 }, (_, i) => team(`p${i}`, "C0"));
  const autos = conferences.slice(1).map((conf) => team(`${conf}-best`, conf, 8, 8));
  const teams = [...power, ...autos];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map(conferences.map((conf, i) => [conf, i === 0 ? "p0" : `${conf}-best`]));
  const sCurve = power.map((item) => item.id);
  const result = assignField(sCurve, teamsById, conferences, best, 6);
  assert.ok(result.firstFourOut.includes("p3"));
  const spot = spotForTeam("p3", sCurve, result);
  assert.equal(spot.band, "first-four-out");
  assert.equal(spotLabel(spot), "First 4 out");
  assert.equal(spot.seed, null);
});

test("last four at-larges in the field are Last 4 In", () => {
  const conferences = ["C0"];
  const power = Array.from({ length: 8 }, (_, i) => team(`p${i}`, "C0"));
  const teamsById = new Map(power.map((item) => [item.id, item]));
  const result = assignField(
    power.map((item) => item.id),
    teamsById,
    conferences,
    new Map([["C0", "p0"]]),
    8,
  );
  const lastIn = result.atLargeIds.slice(-4);
  assert.equal(lastIn.length, 4);
  for (const id of lastIn) {
    const spot = spotForTeam(id, result.field.map((row) => row.teamId), result);
    assert.equal(spot.band, "last-four-in");
    assert.equal(spotLabel(spot), "Last 4 in");
  }
});

test("seed lines list four First Round spots and even play-in pairs", () => {
  const seeds = Array.from({ length: FIELD_SIZE }, (_, i) => seedForFieldIndex(i));
  const counts = new Map<number, number>();
  for (const seed of seeds) counts.set(seed, (counts.get(seed) ?? 0) + 1);

  assert.equal(counts.get(1), SEED_LINE_SPOTS);
  assert.equal(counts.get(11), 8);
  assert.equal(counts.get(12), 6);
  assert.equal(counts.get(13), SEED_LINE_SPOTS);
  assert.equal(counts.get(15), 6);
  assert.equal(counts.get(16), 8);
  assert.equal(seeds.length, FIELD_SIZE);
  assert.equal(
    Array.from({ length: 16 }, (_, i) => seedLineSize(i + 1)).reduce((sum, size) => sum + size, 0),
    FIELD_SIZE,
  );
  assert.equal(
    Array.from({ length: 16 }, (_, i) => seedLinePlayInGames(i + 1)).reduce((sum, n) => sum + n, 0),
    PLAY_IN_GAMES,
  );
  assert.equal(
    Array.from({ length: 16 }, (_, i) => seedLinePlayInTeams(i + 1)).reduce((sum, n) => sum + n, 0),
    PLAY_IN_TEAMS,
  );

  for (let seed = 1; seed <= 16; seed++) {
    const listed = seedLineSize(seed);
    const playIn = seedLinePlayInTeams(seed);
    assert.equal(playIn % 2, 0, `${seed}-line play-in count must be even`);
    assert.equal(listed - playIn / 2, SEED_LINE_SPOTS, `${seed}-line must collapse to four spots`);
  }
});

function assertFourSpotLines(field: CbbFieldTeam[]): void {
  for (let seed = 1; seed <= 16; seed++) {
    const listed = field.filter((row) => row.seed === seed);
    const playIn = listed.filter((row) => row.playIn);
    assert.equal(playIn.length % 2, 0, `${seed}-line play-in must be even`);
    if (!listed.length) continue;
    assert.equal(listed.length - playIn.length / 2, SEED_LINE_SPOTS, `${seed}-line must collapse to four spots`);
  }
}

function assertNoAtLargeByeBelowPlayIn(field: CbbFieldTeam[]): void {
  const alPlayIn = field.filter((row) => row.role === "at-large" && row.playIn);
  const alByes = field.filter((row) => row.role === "at-large" && !row.playIn);
  if (!alPlayIn.length || !alByes.length) return;
  const bestPlayIn = Math.min(...alPlayIn.map((row) => row.sCurveIndex));
  const worstBye = Math.max(...alByes.map((row) => row.sCurveIndex));
  assert.ok(worstBye < bestPlayIn, "no at-large bye may be ranked below a play-in at-large");
}

test("76-team field marks 24 Opening Round teams in even seed-line pairs", () => {
  const conferences = Array.from({ length: 32 }, (_, i) => `C${i}`);
  const power = Array.from({ length: 50 }, (_, i) => team(`p${i}`, "C0"));
  const autos = conferences.slice(1).map((conf) => team(`${conf}-best`, conf, 8, 8));
  const teams = [...power, ...autos];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map(conferences.map((conf, i) => [conf, i === 0 ? "p0" : `${conf}-best`]));
  const sCurve = [...power.map((item) => item.id), ...autos.map((item) => item.id)];

  const result = assignField(sCurve, teamsById, conferences, best);
  assert.equal(result.field.length, FIELD_SIZE);
  assert.ok(result.atLargeIds.includes("p0"));
  assert.equal(result.atLargeIds.length, FIELD_SIZE - result.autoBidsReserved);
  assert.equal(result.autoBidsTotal, conferences.length);
  assert.equal(result.autoBidsReserved, conferences.length - 1);
  assert.equal(Object.keys(result.autoBidByConference).length, conferences.length);

  const playIn = result.field.filter((row) => row.playIn);
  assert.equal(playIn.length, PLAY_IN_TEAMS);
  assert.ok(
    playIn.every((row) => (row.role === "auto-bid" ? row.seed === 15 || row.seed === 16 : true)),
    "auto-bids only play in on 15/16",
  );
  assert.ok(
    playIn.filter((row) => row.seed === 11 || row.seed === 12 || row.seed === 13).every((row) => row.role === "at-large"),
  );
  assertFourSpotLines(result.field);
  assertNoAtLargeByeBelowPlayIn(result.field);

  for (let seed = 1; seed <= 16; seed++) {
    const marked = result.field.filter((row) => row.seed === seed && row.playIn);
    if (seed === 15 || seed === 16) {
      assert.ok(marked.every((row) => row.role === "auto-bid"));
    }
  }
});

test("conference auto-bid is always in the field, never First or Next 4 Out", () => {
  const conferences = ["WAC", "A", "B", "C"];
  const decoy = team("utahvalley", "WAC");
  const leader = team("grandcanyon", "WAC", 8, 8);
  const others = [
    team("a1", "A"),
    team("a2", "A"),
    team("a3", "A"),
    team("b1", "B"),
    team("c1", "C"),
  ];
  const teams = [decoy, leader, ...others];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map([
    ["WAC", "grandcanyon"],
    ["A", "a1"],
    ["B", "b1"],
    ["C", "c1"],
  ]);
  const result = assignField(
    ["utahvalley", "a1", "a2", "a3", "b1", "c1", "grandcanyon"],
    teamsById,
    conferences,
    best,
    6,
  );
  assert.ok(result.field.some((row) => row.teamId === "grandcanyon"));
  assert.equal(result.autoBidByConference.WAC, "grandcanyon");
  assert.ok(!result.firstFourOut.includes("grandcanyon"));
  assert.ok(!result.nextFourOut.includes("grandcanyon"));
  assert.ok(!result.atLargeIds.includes("grandcanyon"));
});

test("live conference leaders replace a stale snapshot auto-bid map", () => {
  const conferences = ["WAC", "A", "B", "C"];
  const teams = [
    team("utahvalley", "WAC"),
    team("grandcanyon", "WAC"),
    team("a1", "A"),
    team("a2", "A"),
    team("a3", "A"),
    team("b1", "B"),
    team("c1", "C"),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const metrics = rankedMetrics(["grandcanyon", "a1", "b1", "c1", "utahvalley", "a2", "a3"]);
  const live = bestTeamByConference(teams, teamsById, metrics);
  assert.equal(live.get("WAC"), "grandcanyon");

  const sCurve = ["utahvalley", "a1", "a2", "a3", "b1", "c1", "grandcanyon"];
  const stale = assignField(
    sCurve,
    teamsById,
    conferences,
    new Map([
      ["WAC", "utahvalley"],
      ["A", "a1"],
      ["B", "b1"],
      ["C", "c1"],
    ]),
    6,
  );
  assert.ok(stale.nextFourOut.includes("grandcanyon") || stale.firstFourOut.includes("grandcanyon"));

  const result = assignField(sCurve, teamsById, conferences, live, 6);
  assert.ok(result.field.some((row) => row.teamId === "grandcanyon"));
  assert.equal(result.autoBidByConference.WAC, "grandcanyon");
  assert.ok(!result.firstFourOut.includes("grandcanyon"));
  assert.ok(!result.nextFourOut.includes("grandcanyon"));
});

test("an auto-bid missing from a full s-curve still evicts an at-large", () => {
  const conferences = ["A", "B", "C", "WAC"];
  const teams = [
    team("a1", "A"),
    team("a2", "A"),
    team("a3", "A"),
    team("a4", "A"),
    team("b1", "B"),
    team("c1", "C"),
    team("grandcanyon", "WAC"),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map([
    ["A", "a1"],
    ["B", "b1"],
    ["C", "c1"],
    ["WAC", "grandcanyon"],
  ]);
  const result = assignField(["a1", "a2", "a3", "a4"], teamsById, conferences, best, 4);
  assert.ok(result.field.some((row) => row.teamId === "grandcanyon"));
  assert.equal(result.autoBidByConference.WAC, "grandcanyon");
  assert.equal(result.field.length, 4);
  assert.ok(!result.firstFourOut.includes("grandcanyon"));
  assert.ok(!result.nextFourOut.includes("grandcanyon"));
});

test("markPlayIn never leaves a lone play-in on a seed line", () => {
  const marked = markPlayIn(dummyField());
  const playIn = marked.filter((row) => row.playIn);
  assert.ok(playIn.length % 2 === 0);
  assertFourSpotLines(marked);
  assertNoAtLargeByeBelowPlayIn(marked);
  assert.ok(playIn.every((row) => (row.role === "auto-bid" ? row.seed === 15 || row.seed === 16 : true)));
  for (let i = 0; i < marked.length; i++) {
    assert.equal(marked[i]?.sCurveIndex, i, "rank order stays the seed-list order");
  }
});

test("a 12-seed auto-bid gets a bye and the at-large on that line plays in", () => {
  const twelve: CbbFieldTeam[] = [
    { teamId: "utahst", role: "at-large", sCurveIndex: 48, seed: 12, playIn: false },
    { teamId: "michigan", role: "at-large", sCurveIndex: 49, seed: 12, playIn: false },
    { teamId: "highpoint", role: "auto-bid", sCurveIndex: 50, seed: 12, playIn: false },
    { teamId: "kentucky", role: "at-large", sCurveIndex: 51, seed: 12, playIn: false },
    { teamId: "newmexico", role: "at-large", sCurveIndex: 52, seed: 12, playIn: false },
    { teamId: "stanford", role: "at-large", sCurveIndex: 53, seed: 12, playIn: false },
  ];
  const marked = markPlayIn(twelve);
  const byId = new Map(marked.map((row) => [row.teamId, row]));
  assert.equal(byId.get("highpoint")?.playIn, false);
  assert.equal(byId.get("utahst")?.playIn, false);
  assert.equal(byId.get("michigan")?.playIn, true);
  assert.equal(byId.get("kentucky")?.playIn, true);
  assert.equal(byId.get("newmexico")?.playIn, true);
  assert.equal(byId.get("stanford")?.playIn, true);
  assert.equal(marked.filter((row) => row.playIn).length, 4);
});

function dummyRole(seed: number, index: number): CbbFieldTeam["role"] {
  if (seed === 15 || seed === 16 || seed === 13 || seed === 14) return "auto-bid";
  if (seed === 11 || seed === 12) return "at-large";
  return index < 32 ? "auto-bid" : "at-large";
}

function dummyField(
  overrides: Record<number, string> = {},
  roles: Record<number, CbbFieldTeam["role"]> = {},
): CbbFieldTeam[] {
  return Array.from({ length: FIELD_SIZE }, (_, index) => {
    const seed = seedForFieldIndex(index);
    return {
      teamId: overrides[index] ?? `t${index}`,
      role: roles[index] ?? dummyRole(seed, index),
      sCurveIndex: index,
      seed,
      playIn: false,
    };
  });
}

/** 11/12/13 at-larges matching the live board: Miami through Pitt. */
function screenshotField(): CbbFieldTeam[] {
  return dummyField(
    {
      40: "notredame",
      41: "miami",
      42: "setonhall",
      43: "xavier",
      44: "tcu",
      45: "georgia",
      46: "santaclara",
      47: "ucf",
      48: "utahst",
      49: "michigan",
      50: "highpoint",
      51: "kentucky",
      52: "newmexico",
      53: "stanford",
      54: "pitt",
      55: "miamioh",
      56: "uic",
      57: "carkansas",
    },
    {
      46: "auto-bid",
      50: "auto-bid",
      54: "at-large",
      55: "auto-bid",
      56: "auto-bid",
      57: "auto-bid",
    },
  );
}

test("play-ins keep ranked order and pack 11/12/13 around auto-bid byes", () => {
  const marked = markPlayIn(screenshotField());
  const byId = new Map(marked.map((row) => [row.teamId, row]));

  for (let i = 0; i < marked.length; i++) {
    assert.equal(marked[i]?.sCurveIndex, i, "rank order stays the seed-list order");
  }

  assert.equal(byId.get("notredame")?.seed, 11);
  assert.equal(byId.get("notredame")?.playIn, false);
  assert.equal(byId.get("santaclara")?.seed, 11);
  assert.equal(byId.get("santaclara")?.playIn, false);
  for (const id of ["georgia", "tcu", "xavier", "setonhall"]) {
    assert.equal(byId.get(id)?.seed, 11, `${id} stays an 11-seed play-in`);
    assert.equal(byId.get(id)?.playIn, true, `${id} stays an 11-seed play-in`);
  }

  assert.equal(byId.get("highpoint")?.seed, 12);
  assert.equal(byId.get("highpoint")?.playIn, false);
  for (const id of ["stanford", "newmexico", "michigan", "miami", "utahst", "ucf"]) {
    assert.equal(byId.get(id)?.seed, 12, `${id} is a 12-seed play-in`);
    assert.equal(byId.get(id)?.playIn, true, `${id} is a 12-seed play-in`);
  }

  assert.equal(byId.get("pitt")?.seed, 13);
  assert.equal(byId.get("pitt")?.playIn, true);
  assert.equal(byId.get("kentucky")?.seed, 13);
  assert.equal(byId.get("kentucky")?.playIn, true);

  assert.equal(marked.filter((row) => row.seed === 11).length, 6);
  assert.equal(marked.filter((row) => row.seed === 12).length, 7);
  assert.equal(marked.filter((row) => row.seed === 13).length, 5);
  assertFourSpotLines(marked);
  assertNoAtLargeByeBelowPlayIn(marked);
  assert.ok(
    marked.every((row) => (row.role === "auto-bid" && row.playIn ? row.seed === 15 || row.seed === 16 : true)),
  );
});

test("teamsAboveCurrent is empty at the first pair", () => {
  const ids = ["a", "b", "c", "d", "e"];
  assert.deepEqual(teamsAboveCurrent(ids, 1), []);
  assert.deepEqual(teamsAboveCurrent(ids, 0), []);
});

test("teamsAboveCurrent keeps the closest completed teams, nearest last", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
  assert.deepEqual(teamsAboveCurrent(ids, 5), ["a", "b", "c", "d"]);
  assert.deepEqual(teamsAboveCurrent(ids, 11), ["c", "d", "e", "f", "g", "h", "i", "j"]);
  assert.equal(teamsAboveCurrent(ids, 11).length, COMPLETED_ABOVE);
  assert.equal(teamsAboveCurrent(ids, 11).at(-1), "j");
});

test("padAboveSlots fills empty slots at the top and stays at eight", () => {
  assert.equal(padAboveSlots([]).length, COMPLETED_ABOVE);
  assert.deepEqual(padAboveSlots([]), Array.from({ length: COMPLETED_ABOVE }, () => null));
  assert.deepEqual(padAboveSlots(["a", "b"]), [
    null,
    null,
    null,
    null,
    null,
    null,
    "a",
    "b",
  ]);
  const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
  assert.deepEqual(padAboveSlots(eight), eight);
  assert.deepEqual(padAboveSlots([...eight, "i", "j"]), eight.slice(2).concat(["i", "j"]));
  assert.deepEqual(padAboveSlots(["a"], 3), [null, null, "a"]);
});

test("fieldResultsForTeam keeps wins and losses against the current field", () => {
  const conferences = ["ACC", "B1G", "SEC"];
  const teams = [
    team("duke", "ACC"),
    team("unc", "ACC"),
    team("purdue", "B1G"),
    team("kentucky", "SEC"),
    team("wake", "ACC"),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const assignment = assignField(
    ["duke", "unc", "purdue", "kentucky"],
    teamsById,
    conferences,
    new Map([
      ["ACC", "duke"],
      ["B1G", "purdue"],
      ["SEC", "kentucky"],
    ]),
    4,
  );
  const games = [
    { id: "1", homeTeamId: "duke", awayTeamId: "unc", winnerId: "duke", status: "final" as const },
    { id: "2", homeTeamId: "duke", awayTeamId: "purdue", winnerId: "purdue", status: "final" as const },
    { id: "3", homeTeamId: "duke", awayTeamId: "wake", winnerId: "duke", status: "final" as const },
    { id: "4", homeTeamId: "duke", awayTeamId: "kentucky", winnerId: null, status: "scheduled" as const },
  ];
  const results = fieldResultsForTeam("duke", games, assignment);
  assert.deepEqual(
    results.map((row) => `${row.result}:${row.opponentId}`),
    ["W:unc", "L:purdue"],
  );
});

test("spotFromRank shows seed and play-in as the seed list is built", () => {
  assert.deepEqual(spotFromRank(1), { rank: 1, seed: 1, playIn: false, band: "field" });
  assert.deepEqual(spotFromRank(4), { rank: 4, seed: 1, playIn: false, band: "field" });
  assert.deepEqual(spotFromRank(5), { rank: 5, seed: 2, playIn: false, band: "field" });
  assert.equal(spotFromRank(41).seed, 11);
  assert.equal(spotFromRank(41).playIn, true);
  assert.equal(spotFromRank(48).seed, 11);
  assert.equal(spotFromRank(48).playIn, true);
  assert.equal(spotFromRank(49).seed, 12);
  assert.equal(spotFromRank(49).playIn, false);
  assert.equal(spotFromRank(51).seed, 12);
  assert.equal(spotFromRank(51).playIn, true);
  assert.equal(spotFromRank(63).seed, 15);
  assert.equal(spotFromRank(63).playIn, false);
  assert.equal(spotFromRank(65).seed, 15);
  assert.equal(spotFromRank(65).playIn, true);
  assert.equal(spotFromRank(69).seed, 16);
  assert.equal(spotFromRank(69).playIn, true);
  assert.equal(spotFromRank(76).seed, 16);
  assert.equal(spotFromRank(76).playIn, true);
  assert.equal(spotFromRank(77).band, "first-four-out");
  assert.equal(spotFromRank(81).band, "next-four-out");
  assert.equal(spotLabel(spotFromRank(1)), "1-seed");
  assert.equal(spotLabel(spotFromRank(69)), "16-seed · Play-in");
  assert.equal(spotLabel(spotFromRank(77)), "First 4 out");
});
