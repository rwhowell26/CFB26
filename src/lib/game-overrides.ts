import type { Game } from "./types";

const MICHIGAN_ID = "130";
const WESTERN_MICHIGAN_ID = "2711";
const ARMY_ID = "349";
const NAVY_ID = "2426";

export function isArmyNavyGame(game: Pick<Game, "homeTeamId" | "awayTeamId">): boolean {
  const ids = new Set([game.homeTeamId, game.awayTeamId]);
  return ids.has(ARMY_ID) && ids.has(NAVY_ID);
}

/** Manual corrections applied after ESPN fetch. */
export function applyGameOverrides(games: Game[]): Game[] {
  return games.map((game) => {
    let next = game;
    const ids = new Set([game.homeTeamId, game.awayTeamId]);
    if (ids.has(MICHIGAN_ID) && ids.has(WESTERN_MICHIGAN_ID) && game.week === 1) {
      const wmuIsHome = game.homeTeamId === WESTERN_MICHIGAN_ID;
      next = {
        ...next,
        status: "final",
        homeScore: wmuIsHome ? 12 : 7,
        awayScore: wmuIsHome ? 7 : 12,
      };
    }
    // ESPN lists Army–Navy as an AAC game; the league does not count it.
    if (isArmyNavyGame(next) && (next.conferenceGame || next.conferenceGroup)) {
      next = {
        ...next,
        conferenceGame: false,
        conferenceGroup: null,
      };
    }
    return next;
  });
}
