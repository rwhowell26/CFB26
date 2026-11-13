import assert from "node:assert/strict";
import { test } from "node:test";
import { assignField } from "./cbb-bracket";
import { FIRST_ROUND_SEEDS, placeBracket, REGION_IDS, slotTeams } from "./cbb-place-bracket";
import { FIELD_SIZE, PLAY_IN_GAMES, PLAY_IN_TEAMS } from "./cbb-season";
import type { CbbTeam } from "./cbb-types";

function team(id: string, conference: string, wins = 10, losses = 2): CbbTeam {
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

function mixedField() {
  const conferences = Array.from({ length: 32 }, (_, i) => `C${i}`);
  const top = Array.from({ length: 16 }, (_, i) => team(`t${i}`, `C${i % 4}`));
  const moreAl = Array.from({ length: 32 }, (_, i) => team(`al${i}`, `C${i % 4}`));
  const champs = conferences.slice(4).map((conf) => team(`${conf}-best`, conf, 8, 8));
  const teams = [...top, ...moreAl, ...champs];
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const best = new Map(
    conferences.map((conf, i) => [conf, i < 4 ? `t${i}` : `${conf}-best`] as const),
  );
  const sCurve = teams.map((item) => item.id);
  const assignment = assignField(sCurve, teamsById, conferences, best);
  return { teamsById, assignment };
}

test("placeBracket fills four regions and 12 Opening Round games from the seed list", () => {
  const { teamsById, assignment } = mixedField();
  const bracket = placeBracket(assignment.field, teamsById);
  assert.equal(assignment.field.length, FIELD_SIZE);
  assert.equal(bracket.openingRound.length, PLAY_IN_GAMES);
  assert.equal(
    bracket.openingRound.flatMap((game) => game.teamIds).length,
    PLAY_IN_TEAMS,
  );
  const seen = new Set<string>();
  for (const id of REGION_IDS) {
    const region = bracket.regions[id];
    assert.equal(region.slots.length, 16);
    assert.deepEqual(
      region.slots.map((slot) => slot.seed),
      [...FIRST_ROUND_SEEDS],
    );
    for (const slot of region.slots) {
      for (const teamId of slotTeams(slot)) {
        assert.ok(!seen.has(teamId), `${teamId} placed twice`);
        seen.add(teamId);
      }
    }
  }
  assert.equal(seen.size, FIELD_SIZE);
});

test("overall 1 vs 4 and 2 vs 3 meet in the Final Four; 1-seeds take four regions", () => {
  const { teamsById, assignment } = mixedField();
  const bracket = placeBracket(assignment.field, teamsById);
  assert.deepEqual(bracket.finalFour.left, ["east", "midwest"]);
  assert.deepEqual(bracket.finalFour.right, ["west", "south"]);
  const ones = REGION_IDS.map((id) => {
    const slot = bracket.regions[id].slots.find((row) => row.seed === 1);
    return slot?.teamId;
  });
  assert.deepEqual(new Set(ones).size, 4);
  assert.equal(bracket.regions.east.slots.find((row) => row.seed === 1)?.teamId, "t0");
});

test("the first four teams from a conference on seed lines 1-4 go to four regions", () => {
  const { teamsById, assignment } = mixedField();
  const bracket = placeBracket(assignment.field, teamsById);
  const regions = new Set<string>();
  for (const id of REGION_IDS) {
    for (const seed of [1, 2, 3, 4]) {
      const slot = bracket.regions[id].slots.find((row) => row.seed === seed);
      const teamId = slotTeams(slot!)[0];
      if (teamsById.get(teamId ?? "")?.conference === "C0") regions.add(id);
    }
  }
  assert.equal(regions.size, 4);
});

test("Opening Round games pair two play-in teams on the same seed line", () => {
  const { teamsById, assignment } = mixedField();
  const bracket = placeBracket(assignment.field, teamsById);
  for (const game of bracket.openingRound) {
    const left = assignment.field.find((row) => row.teamId === game.teamIds[0]);
    const right = assignment.field.find((row) => row.teamId === game.teamIds[1]);
    assert.equal(left?.seed, game.seed);
    assert.equal(right?.seed, game.seed);
    assert.equal(left?.playIn, true);
    assert.equal(right?.playIn, true);
    assert.equal(left?.role, right?.role);
  }
});
