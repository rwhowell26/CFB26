import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignField,
  bestTeamByConference,
  conferenceInField,
  markPlayIn,
  padAboveSlots,
  recommendNewTeams,
  seedForFieldIndex,
  seedLineSize,
  seedWorkingPool,
  spotFromRank,
  spotLabel,
  teamsAboveCurrent,
} from "./cbb-bracket";
import { emptyMetrics } from "./cbb-metrics";
import {
  COMPLETED_ABOVE,
  FIELD_SIZE,
  PLAY_IN_AT_LARGE_TEAMS,
  PLAY_IN_TEAMS,
  PLAY_IN_16_TEAMS,
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
  assert.deepEqual(result.atLargeIds, ["a2", "a3"]);
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
  assert.equal(result.atLargeIds.length, 2);
  assert.equal(Object.keys(result.autoBidByConference).length, 4);
  assert.ok(!result.atLargeIds.includes("p9"));
  assert.ok(result.firstFourOut.includes("p3"));
});

test("recommendNewTeams keeps teams within 10 of the last Next 4 Out", () => {
  const teams = [
    team("in1", "A"),
    team("bubble8", "B"),
    team("newClose", "C"),
    team("newFar", "D"),
  ];
  const metrics = rankedMetrics(["in1", "bubble8", "newClose", "newFar"]);
  metrics.set("bubble8", { ...emptyMetrics("bubble8"), sor: 20, kpi: 20, wab: 20 });
  metrics.set("newClose", { ...emptyMetrics("newClose"), sor: 28, kpi: 28, wab: 28 });
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
  const recs = recommendNewTeams(teams, metrics, previous, 10);
  assert.deepEqual(recs, ["newClose"]);
});

test("seedWorkingPool prepends last S-curve and appends missing auto-bids", () => {
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
  const pool = seedWorkingPool(teams, metrics, previous);
  assert.ok(pool.includes("unc"));
  assert.ok(pool.includes("iowa"));
  assert.equal(pool.length, 2);
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

test("seedWorkingPool injects a conference leader even when the average sits below the cut", () => {
  const power = Array.from({ length: 80 }, (_, i) => team(`p${i}`, "Power"));
  const mid = team("mid", "MVC");
  const teams = [...power, mid];
  const metrics = new Map<string, CbbTeamMetrics>();
  for (const item of power) {
    const rank = Number(item.id.slice(1)) + 1;
    metrics.set(item.id, { ...emptyMetrics(item.id), kenpom: rank });
  }
  metrics.set("mid", { ...emptyMetrics("mid"), kenpom: 200 });
  const pool = seedWorkingPool(teams, metrics, null);
  assert.ok(pool.includes("mid"));
  assert.equal(pool.length, 81);
  assert.equal(pool[0], "p0");
});

test("play-in seeds 11 and 16 hold ten teams in a 76-team field", () => {
  const seeds = Array.from({ length: FIELD_SIZE }, (_, i) => seedForFieldIndex(i));
  assert.equal(seeds.filter((seed) => seed === 11).length, 10);
  assert.equal(seeds.filter((seed) => seed === 16).length, 10);
  assert.equal(seeds.filter((seed) => seed === 1).length, 4);
  assert.equal(seeds.filter((seed) => seed === 12).length, 4);
  assert.equal(seeds.length, FIELD_SIZE);
  assert.equal(
    Array.from({ length: 16 }, (_, i) => seedLineSize(i + 1)).reduce((sum, size) => sum + size, 0),
    FIELD_SIZE,
  );
});

test("76-team field marks 16 play-in teams: eight 16-seeds and eight last at-larges", () => {
  const conferences = Array.from({ length: 32 }, (_, i) => `C${i}`);
  const power = Array.from({ length: 50 }, (_, i) => team(`p${i}`, "C0"));
  const autos = conferences.slice(1).map((conf) => team(`${conf}-best`, conf, 8, 8));
  const teams = [...power, ...autos];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map(conferences.map((conf, i) => [conf, i === 0 ? "p0" : `${conf}-best`]));
  const sCurve = [...power.map((item) => item.id), ...autos.map((item) => item.id)];

  const result = assignField(sCurve, teamsById, conferences, best);
  assert.equal(result.field.length, FIELD_SIZE);
  assert.equal(result.atLargeIds.length, FIELD_SIZE - conferences.length);
  assert.equal(Object.keys(result.autoBidByConference).length, conferences.length);

  const playIn = result.field.filter((row) => row.playIn);
  assert.equal(playIn.length, PLAY_IN_TEAMS);
  assert.equal(playIn.filter((row) => row.seed === 16).length, PLAY_IN_16_TEAMS);
  assert.equal(playIn.filter((row) => row.role === "at-large").length, PLAY_IN_AT_LARGE_TEAMS);
  assert.equal(
    playIn.filter((row) => row.seed === 16).length + playIn.filter((row) => row.role === "at-large").length,
    PLAY_IN_TEAMS,
  );
});

test("markPlayIn keeps 16-seed games and last at-larges from overlapping", () => {
  const field: CbbFieldTeam[] = Array.from({ length: FIELD_SIZE }, (_, index) => ({
    teamId: `t${index}`,
    role: index >= 32 ? "at-large" : "auto-bid",
    sCurveIndex: index,
    seed: seedForFieldIndex(index),
    playIn: false,
  }));
  const marked = markPlayIn(field);
  const playIn = marked.filter((row) => row.playIn);
  assert.equal(playIn.length, PLAY_IN_TEAMS);
  assert.equal(playIn.filter((row) => row.seed === 16).length, PLAY_IN_16_TEAMS);
  assert.equal(playIn.filter((row) => row.role === "at-large" && row.seed !== 16).length, PLAY_IN_AT_LARGE_TEAMS);
  const lastAtLarge = field
    .filter((row) => row.role === "at-large" && row.seed !== 16)
    .slice(-PLAY_IN_AT_LARGE_TEAMS);
  for (const row of lastAtLarge) {
    assert.equal(marked.find((item) => item.teamId === row.teamId)?.playIn, true);
  }
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

test("conferenceInField lists conference-mates already in the 76", () => {
  const conferences = ["ACC", "B1G", "SEC"];
  const teams = [
    team("duke", "ACC"),
    team("unc", "ACC"),
    team("ncst", "ACC"),
    team("purdue", "B1G"),
    team("kentucky", "SEC"),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map([
    ["ACC", "duke"],
    ["B1G", "purdue"],
    ["SEC", "kentucky"],
  ]);
  const result = assignField(
    ["duke", "unc", "purdue", "kentucky", "ncst"],
    teamsById,
    conferences,
    best,
    5,
  );

  const acc = conferenceInField("unc", result, teamsById);
  assert.deepEqual(
    acc.map((row) => row.teamId),
    ["duke", "unc", "ncst"],
  );
  assert.ok(acc.every((row) => teamsById.get(row.teamId)?.conference === "ACC"));

  const bigTen = conferenceInField("purdue", result, teamsById);
  assert.deepEqual(
    bigTen.map((row) => row.teamId),
    ["purdue"],
  );
  assert.equal(bigTen[0]?.role, "auto-bid");

  assert.deepEqual(conferenceInField("missing", result, teamsById), []);
});

test("spotFromRank shows seed and play-in as the seed list is built", () => {
  assert.deepEqual(spotFromRank(1), { rank: 1, seed: 1, playIn: false, band: "field" });
  assert.deepEqual(spotFromRank(4), { rank: 4, seed: 1, playIn: false, band: "field" });
  assert.deepEqual(spotFromRank(5), { rank: 5, seed: 2, playIn: false, band: "field" });
  assert.equal(spotFromRank(41).seed, 11);
  assert.equal(spotFromRank(41).playIn, false);
  assert.equal(spotFromRank(43).seed, 11);
  assert.equal(spotFromRank(43).playIn, true);
  assert.equal(spotFromRank(67).seed, 16);
  assert.equal(spotFromRank(67).playIn, false);
  assert.equal(spotFromRank(69).seed, 16);
  assert.equal(spotFromRank(69).playIn, true);
  assert.equal(spotFromRank(76).seed, 16);
  assert.equal(spotFromRank(77).band, "first-four-out");
  assert.equal(spotFromRank(81).band, "next-four-out");
  assert.equal(spotLabel(spotFromRank(1)), "1-seed");
  assert.equal(spotLabel(spotFromRank(69)), "16-seed · Play-in");
  assert.equal(spotLabel(spotFromRank(77)), "First 4 out");
});
