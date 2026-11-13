import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyContentionMove,
  applyContentionMoves,
  conferenceLeaderAverages,
  contentionCandidates,
  contentionMoves,
  contentionRosterIds,
  projectionContentionIds,
  withCandidateReasons,
} from "./cbb-contention";
import { emptyMetrics } from "./cbb-metrics";
import { CONTENTION_WITHIN } from "./cbb-season";
import type { CbbSnapshot, CbbTeam, CbbTeamMetrics } from "./cbb-types";

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

function metrics(id: string, rank: number): CbbTeamMetrics {
  return {
    ...emptyMetrics(id),
    sor: rank,
    kpi: rank,
    wab: rank,
    kenpom: rank,
    bpi: rank,
    torvik: rank,
  };
}

function snapshot(partial: Partial<CbbSnapshot> = {}): CbbSnapshot {
  return {
    id: "snap",
    createdAt: "2026-11-13T00:00:00.000Z",
    label: "Nov 13, 2026",
    sCurve: [],
    atLargeIds: [],
    autoBidByConference: {},
    firstFourOut: [],
    nextFourOut: [],
    recommendedIds: [],
    ...partial,
  };
}

test("projection includes field, reserved auto-bids, First 4 Out, and Next 4 Out", () => {
  const ids = projectionContentionIds(
    snapshot({
      atLargeIds: ["duke", "unc"],
      autoBidByConference: { ACC: "duke", SoCon: "furman" },
      firstFourOut: ["seton"],
      nextFourOut: ["vcu"],
    }),
  );
  assert.deepEqual([...ids.field].sort(), ["duke", "furman", "unc"]);
  assert.ok(ids.firstFourOut.has("seton"));
  assert.ok(ids.nextFourOut.has("vcu"));
  assert.equal(ids.all.size, 5);
});

test("conference teammates within 50 of the leader are in contention", () => {
  const teams = [
    team("leader", "SEC"),
    team("close", "SEC"),
    team("edge", "SEC"),
    team("out", "SEC"),
    team("other", "ACC"),
  ];
  const map = new Map<string, CbbTeamMetrics>([
    ["leader", metrics("leader", 10)],
    ["close", metrics("close", 40)],
    ["edge", metrics("edge", 10 + CONTENTION_WITHIN)],
    ["out", metrics("out", 10 + CONTENTION_WITHIN + 1)],
    ["other", metrics("other", 12)],
  ]);
  const rows = contentionCandidates(teams, map, null);
  const ids = rows.map((row) => row.teamId);
  assert.ok(ids.includes("leader"));
  assert.ok(ids.includes("close"));
  assert.ok(ids.includes("edge"));
  assert.ok(!ids.includes("out"));
  assert.ok(ids.includes("other"));
  assert.equal(rows.find((row) => row.teamId === "close")?.conferenceGap, 30);
  assert.deepEqual(rows.find((row) => row.teamId === "close")?.reasons, ["conference"]);
});

test("last projection teams are included even if they are far from their conference leader", () => {
  const teams = [team("duke", "ACC"), team("wake", "ACC"), team("bubble", "A-10")];
  const map = new Map<string, CbbTeamMetrics>([
    ["duke", metrics("duke", 5)],
    ["wake", metrics("wake", 200)],
    ["bubble", metrics("bubble", 80)],
  ]);
  const rows = contentionCandidates(
    teams,
    map,
    snapshot({
      atLargeIds: ["duke"],
      firstFourOut: ["wake"],
      nextFourOut: ["bubble"],
    }),
  );
  assert.ok(rows.some((row) => row.teamId === "wake" && row.reasons.includes("first-four-out")));
  assert.ok(rows.some((row) => row.teamId === "bubble" && row.reasons.includes("next-four-out")));
  assert.ok(!rows.find((row) => row.teamId === "wake")?.reasons.includes("conference"));
});

test("null approved roster has no pending moves; seed is the current criteria", () => {
  const candidates = ["a", "b", "c"];
  assert.deepEqual(contentionMoves(candidates, null), []);
  assert.deepEqual(contentionRosterIds(candidates, null).sort(), ["a", "b", "c"]);
});

test("approved roster keeps pending drops until they are confirmed", () => {
  assert.deepEqual(contentionRosterIds(["keep", "add"], ["keep", "drop"]), ["keep", "drop"]);
});

test("new and eliminated teams become pending adds and drops", () => {
  const candidates = contentionCandidates(
    [
      team("keep", "ACC"),
      team("add", "ACC"),
      team("ivy-leader", "Ivy"),
      team("drop", "Ivy"),
    ],
    new Map([
      ["keep", metrics("keep", 8)],
      ["add", metrics("add", 20)],
      ["ivy-leader", metrics("ivy-leader", 5)],
      ["drop", metrics("drop", 200)],
    ]),
    snapshot({ atLargeIds: ["keep"] }),
  );
  const candidateIds = candidates.map((row) => row.teamId);
  const moves = withCandidateReasons(contentionMoves(candidateIds, ["keep", "drop"]), candidates);
  const adds = moves.filter((move) => move.kind === "add").map((move) => move.teamId);
  const drops = moves.filter((move) => move.kind === "drop").map((move) => move.teamId);
  assert.ok(adds.includes("add"));
  assert.deepEqual(drops, ["drop"]);
  assert.ok(moves.find((move) => move.teamId === "add")?.reasons.includes("conference"));
});

test("approving an add or drop updates the roster", () => {
  const afterAdd = applyContentionMove(["keep"], { teamId: "new", kind: "add", reasons: [] });
  assert.deepEqual(afterAdd, ["keep", "new"]);
  const afterDrop = applyContentionMove(["keep", "old"], { teamId: "old", kind: "drop", reasons: [] });
  assert.deepEqual(afterDrop, ["keep"]);
  const afterAll = applyContentionMoves(["keep", "old"], [
    { teamId: "new", kind: "add", reasons: [] },
    { teamId: "old", kind: "drop", reasons: [] },
  ]);
  assert.deepEqual(afterAll, ["keep", "new"]);
});

test("conference leader is the lowest six-rank average", () => {
  const teams = [team("b", "Big Ten"), team("a", "Big Ten")];
  const map = new Map([
    ["b", metrics("b", 40)],
    ["a", metrics("a", 11)],
  ]);
  const leaders = conferenceLeaderAverages(teams, map);
  assert.equal(leaders.get("Big Ten")?.teamId, "a");
  assert.equal(leaders.get("Big Ten")?.average, 11);
});
