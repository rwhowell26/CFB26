import assert from "node:assert/strict";
import { test } from "node:test";
import { barttorvikRankColumns, parseKenPomRanks, parseTorvikRanks, ranksFromHigherBetter } from "./cbb-feeds";
import { buildTeamNameIndex } from "./cbb-names";
import type { CbbTeam } from "./cbb-types";

function team(id: string, name: string): CbbTeam {
  return {
    id,
    name,
    shortName: name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    conference: "ACC",
    logo: null,
    color: null,
    alternateColor: null,
    wins: 1,
    losses: 0,
  };
}

test("KenPom markdown stores the published rank, not AdjEM", () => {
  const index = buildTeamNameIndex([team("150", "Duke")]);
  const text = "| 1 | [Duke](https://kenpom.com/team.php?team=Duke) | [ACC](https://kenpom.com/conf.php?c=ACC) | 2-0 | +34.26 |";
  const ranks = parseKenPomRanks(text, index);
  assert.equal(ranks.get("150"), 1);
});

test("Barttorvik CSV uses the rank and WAB Rk columns", () => {
  const header = "rank,team,conf,record,adjoe,oe Rank,adjde,de Rank,barthag,rank,WAB,WAB Rk".split(",");
  assert.deepEqual(barttorvikRankColumns(header), { rank: 0, wabRk: 11 });
  const index = buildTeamNameIndex([team("150", "Duke")]);
  const csv = `${header.join(",")}
1,Duke,ACC,2-0,120.7,4,90.6,1,0.96,1,0.06,99`;
  const parsed = parseTorvikRanks(csv, index);
  assert.equal(parsed.torvik.get("150"), 1);
  assert.equal(parsed.wab.get("150"), 99);
});

test("ranksFromHigherBetter maps the best score to 1", () => {
  const ranks = ranksFromHigherBetter(
    new Map([
      ["a", 12],
      ["b", 40],
      ["c", 5],
    ]),
  );
  assert.equal(ranks.get("b"), 1);
  assert.equal(ranks.get("a"), 2);
  assert.equal(ranks.get("c"), 3);
});
