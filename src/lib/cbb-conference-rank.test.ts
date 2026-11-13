import assert from "node:assert/strict";
import { test } from "node:test";
import { rankCbbConferences } from "./cbb-conference-rank";
import { emptyMetrics } from "./cbb-metrics";
import type { CbbTeam, CbbTeamMetrics } from "./cbb-types";

function team(id: string, conference: string): CbbTeam {
  return {
    id,
    name: id,
    shortName: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    conference,
    logo: null,
    color: null,
    alternateColor: null,
    wins: 10,
    losses: 2,
  };
}

function metricsFor(ranks: Record<string, number>): Map<string, CbbTeamMetrics> {
  const map = new Map<string, CbbTeamMetrics>();
  for (const [id, rank] of Object.entries(ranks)) {
    map.set(id, {
      ...emptyMetrics(id),
      sor: rank,
      kpi: rank,
      wab: rank,
      kenpom: rank,
      bpi: rank,
      torvik: rank,
    });
  }
  return map;
}

test("conferences rank by the average of each team's six-rank average", () => {
  const teams = [
    team("duke", "Atlantic Coast Conference"),
    team("unc", "Atlantic Coast Conference"),
    team("iowa", "Big Ten Conference"),
    team("purdue", "Big Ten Conference"),
    team("gonzaga", "West Coast Conference"),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const metrics = metricsFor({
    duke: 4,
    unc: 12,
    iowa: 20,
    purdue: 8,
    gonzaga: 6,
  });
  const rows = rankCbbConferences(teams, teamsById, metrics);
  assert.deepEqual(
    rows.map((row) => row.shortName),
    ["WCC", "ACC", "Big Ten"],
  );
  assert.equal(rows[0]?.average, 6);
  assert.equal(rows[1]?.average, 8);
  assert.equal(rows[2]?.average, 14);
  assert.equal(rows[0]?.rank, 1);
  assert.equal(rows[0]?.bestTeamId, "gonzaga");
  assert.equal(rows[1]?.bestTeamId, "duke");
  assert.equal(rows[2]?.bestTeamId, "purdue");
});

test("conferences with no metric ranks sort after ranked conferences", () => {
  const teams = [
    team("duke", "Atlantic Coast Conference"),
    team("gonzaga", "West Coast Conference"),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const metrics = metricsFor({ duke: 4 });
  const rows = rankCbbConferences(teams, teamsById, metrics);
  assert.equal(rows[0]?.shortName, "ACC");
  assert.equal(rows[1]?.shortName, "WCC");
  assert.equal(rows[1]?.average, null);
});

test("independents are omitted from conference rankings", () => {
  const teams = [
    team("duke", "Atlantic Coast Conference"),
    team("nd", "Independent"),
  ];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const metrics = metricsFor({ duke: 2, nd: 1 });
  const rows = rankCbbConferences(teams, teamsById, metrics);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.name, "Atlantic Coast Conference");
});
