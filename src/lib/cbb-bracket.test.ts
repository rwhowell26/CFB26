import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignField,
  recommendNewTeams,
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
  metrics.set("newFar", { ...emptyMetrics("newFar"), sor: 40, kpi: 40, wab: 40 });
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
  assert.deepEqual(pool.slice(0, 2), ["unc", "duke"]);
  assert.ok(pool.includes("iowa"));
});
