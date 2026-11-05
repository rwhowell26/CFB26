import assert from "node:assert/strict";
import { test } from "node:test";
import { applyGameOverrides, isArmyNavyGame } from "./game-overrides.ts";
import type { Game } from "./types.ts";

function game(home: string, away: string, extras: Partial<Game> = {}): Game {
  return {
    id: `${home}-${away}`,
    week: 15,
    date: "2026-12-12T20:00:00.000Z",
    neutralSite: true,
    status: "scheduled",
    homeTeamId: home,
    awayTeamId: away,
    homeScore: null,
    awayScore: null,
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
    conferenceGroup: "American Conference",
    ...extras,
  };
}

test("Army-Navy is recognized regardless of home/away", () => {
  assert.equal(isArmyNavyGame(game("349", "2426")), true);
  assert.equal(isArmyNavyGame(game("2426", "349")), true);
  assert.equal(isArmyNavyGame(game("349", "99")), false);
});

test("Army-Navy is stripped of AAC conference flags", () => {
  const [overridden] = applyGameOverrides([game("349", "2426")]);
  assert.equal(overridden?.conferenceGame, false);
  assert.equal(overridden?.conferenceGroup, null);
});
