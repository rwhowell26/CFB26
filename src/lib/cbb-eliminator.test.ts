import assert from "node:assert/strict";
import { test } from "node:test";
import { seedForFieldIndex } from "./cbb-bracket";
import { buildEliminatorBoard, playInForFieldIndex } from "./cbb-eliminator";
import { emptyMetrics } from "./cbb-metrics";
import { FIELD_SIZE, SEED_LINE_SPOTS } from "./cbb-season";
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

function boardOf(
  ids: string[],
  conferences: Record<string, string>,
  locked: string[] = [],
  eliminated: string[] = [],
) {
  const teams = ids.map((id) => team(id, conferences[id] ?? "Indep"));
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const metrics = rankedMetrics(ids);
  return buildEliminatorBoard(teams, teamsById, metrics, locked, eliminated);
}

test("eliminator seeds the top four as 1s and uses Opening Round line sizes", () => {
  const conferences: Record<string, string> = {};
  const ids: string[] = [];
  for (let i = 0; i < 32; i++) {
    const id = `aq${i}`;
    ids.push(id);
    conferences[id] = `C${i}`;
  }
  for (let i = 0; i < 50; i++) {
    const id = `p${i}`;
    ids.push(id);
    conferences[id] = "C0";
  }
  const order = [...ids.filter((id) => id === "aq0" || id.startsWith("p")), ...ids.filter((id) => id.startsWith("aq") && id !== "aq0")];
  const rows = boardOf(order, conferences);
  const inField = rows.filter((row) => row.inField);
  assert.equal(inField.length, FIELD_SIZE);
  assert.equal(rows[0]?.seed, 1);
  assert.equal(rows[3]?.seed, 1);
  assert.equal(rows[4]?.seed, 2);
  assert.equal(rows[7]?.seed, 2);
  assert.equal(inField[40]?.seed, 11);
  assert.equal(inField.filter((row) => row.seed === 11).length, 8);
  assert.equal(inField.filter((row) => row.seed === 12).length, 6);
  assert.equal(inField.filter((row) => row.seed === 16).length, 8);
  for (let seed = 1; seed <= 16; seed++) {
    const listed = inField.filter((row) => row.seed === seed);
    const playIn = listed.filter((row) => row.playIn);
    assert.equal(listed.length - playIn.length / 2, SEED_LINE_SPOTS, `${seed}-line spots`);
  }
});

test("a team behind its conference favorite inherits the next auto-bid seed it ranks above", () => {
  const conferences: Record<string, string> = {};
  const ids: string[] = [];
  for (let i = 0; i < 32; i++) {
    const id = `aq${i}`;
    ids.push(id);
    conferences[id] = `C${i}`;
  }
  conferences.wrightstate = "C31";
  conferences.nku = "C31";
  conferences.kennesaw = "C30";
  const power = Array.from({ length: 50 }, (_, i) => `p${i}`);
  for (const id of power) conferences[id] = "C0";
  const order = [
    "aq0",
    ...power,
    "wrightstate",
    ...ids.slice(1, 13),
    "nku",
    "kennesaw",
    ...ids.slice(13, 30),
  ];
  const rows = boardOf(order, conferences);
  const byId = new Map(rows.map((row) => [row.teamId, row]));
  assert.equal(byId.get("wrightstate")?.inField, true);
  assert.equal(byId.get("wrightstate")?.role, "auto-bid");
  assert.equal(byId.get("nku")?.inField, false);
  assert.equal(byId.get("kennesaw")?.inField, true);
  assert.equal(byId.get("kennesaw")?.role, "auto-bid");
  assert.equal(byId.get("nku")?.role, "conference-chase");
  assert.equal(byId.get("nku")?.seed, byId.get("kennesaw")?.seed);
  assert.ok((byId.get("kennesaw")?.seed ?? 0) >= 13);
});

test("locking a team outside the cut puts them in the field", () => {
  const conferences: Record<string, string> = { a: "A", b: "B", c: "C", d: "D" };
  const ids = ["a", "b", "c", "d", "a2", "a3", "a4", "a5"];
  for (const id of ids) conferences[id] = id.startsWith("a") ? "A" : id.toUpperCase();
  conferences.a = "A";
  conferences.a2 = "A";
  conferences.a3 = "A";
  conferences.a4 = "A";
  conferences.a5 = "A";
  conferences.b = "B";
  conferences.c = "C";
  conferences.d = "D";
  const rows = boardOf(["a", "b", "c", "d", "a2", "a3", "a4", "a5"], conferences, ["a5"]);
  const byId = new Map(rows.map((row) => [row.teamId, row]));
  assert.equal(byId.get("a5")?.inField, true);
  assert.equal(byId.get("a5")?.status, "locked");
});

test("eliminating a conference leader passes the auto-bid to the next team", () => {
  const conferences = { duke: "ACC", unc: "ACC", iowa: "MVC", x: "X", y: "Y" };
  const rows = boardOf(["duke", "unc", "iowa", "x", "y"], conferences, [], ["duke"]);
  const byId = new Map(rows.map((row) => [row.teamId, row]));
  assert.equal(byId.get("duke")?.status, "eliminated");
  assert.equal(byId.get("duke")?.inField, false);
  assert.equal(byId.get("unc")?.role, "auto-bid");
  assert.equal(byId.get("unc")?.inField, true);
});

test("playInForFieldIndex marks the Opening Round slots on 11/12/15/16", () => {
  assert.equal(playInForFieldIndex(0), false);
  assert.equal(seedForFieldIndex(40), 11);
  assert.equal(playInForFieldIndex(40), true);
  assert.equal(playInForFieldIndex(47), true);
  assert.equal(seedForFieldIndex(48), 12);
  assert.equal(playInForFieldIndex(48), false);
  assert.equal(playInForFieldIndex(53), true);
});
