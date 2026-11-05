import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignField,
  bestTeamByConference,
  recommendNewTeams,
  seedForFieldIndex,
  seedWorkingPool,
} from "./cbb-bracket";
import { emptyMetrics } from "./cbb-metrics";
import type { CbbSnapshot, CbbTeam, CbbTeamMetrics } from "./cbb-types";

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
  metrics.set("newFar", { ...emptyMetrics("newFar"), sor: 5, kpi: 5, wab: 5 });
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

test("first board seeds by current six-metric average, highest first", () => {
  const teams = [team("low", "A"), team("high", "B"), team("mid", "C")];
  const metrics = new Map<string, CbbTeamMetrics>([
    ["low", { ...emptyMetrics("low"), kenpom: 4, bpi: 4, torvik: 4, sor: 4, kpi: 4, wab: 4 }],
    ["mid", { ...emptyMetrics("mid"), kenpom: 12, bpi: 12, torvik: 12, sor: 12, kpi: 12, wab: 12 }],
    ["high", { ...emptyMetrics("high"), kenpom: 20, bpi: 20, torvik: 20, sor: 20, kpi: 20, wab: 20 }],
  ]);
  assert.deepEqual(seedWorkingPool(teams, metrics, null), ["high", "mid", "low"]);
});

test("auto-bid is the current highest average in that conference", () => {
  const teams = [team("unc", "ACC"), team("duke", "ACC"), team("iowa", "MVC")];
  const metrics = new Map<string, CbbTeamMetrics>([
    ["unc", { ...emptyMetrics("unc"), kenpom: 18 }],
    ["duke", { ...emptyMetrics("duke"), kenpom: 31 }],
    ["iowa", { ...emptyMetrics("iowa"), kenpom: 9 }],
  ]);
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = bestTeamByConference(teams, teamsById, metrics);
  assert.equal(best.get("ACC"), "duke");
  assert.equal(best.get("MVC"), "iowa");
});

test("seedWorkingPool injects a conference leader even when the average sits below the cut", () => {
  const power = Array.from({ length: 80 }, (_, i) => team(`p${i}`, "Power"));
  const mid = team("mid", "MVC");
  const teams = [...power, mid];
  const metrics = new Map<string, CbbTeamMetrics>();
  for (const item of power) {
    const rating = 80 - Number(item.id.slice(1));
    metrics.set(item.id, { ...emptyMetrics(item.id), kenpom: rating });
  }
  metrics.set("mid", { ...emptyMetrics("mid"), kenpom: 1 });
  const pool = seedWorkingPool(teams, metrics, null);
  assert.ok(pool.includes("mid"));
  assert.equal(pool.length, 76);
  assert.equal(pool[0], "p0");
});

test("play-in seeds 11 and 16 hold six teams", () => {
  const seeds = Array.from({ length: 68 }, (_, i) => seedForFieldIndex(i));
  assert.equal(seeds.filter((seed) => seed === 11).length, 6);
  assert.equal(seeds.filter((seed) => seed === 16).length, 6);
  assert.equal(seeds.filter((seed) => seed === 1).length, 4);
  assert.equal(seeds.length, 68);
});
