import type { Game } from "./types";

const MICHIGAN_ID = "130";
const WESTERN_MICHIGAN_ID = "2711";

/** Manual score corrections applied after ESPN fetch. */
export function applyGameOverrides(games: Game[]): Game[] {
  return games.map((game) => {
    const ids = new Set([game.homeTeamId, game.awayTeamId]);
    if (!ids.has(MICHIGAN_ID) || !ids.has(WESTERN_MICHIGAN_ID)) return game;
    if (game.week !== 1) return game;

    const wmuIsHome = game.homeTeamId === WESTERN_MICHIGAN_ID;
    return {
      ...game,
      status: "final",
      homeScore: wmuIsHome ? 12 : 7,
      awayScore: wmuIsHome ? 7 : 12,
    };
  });
}
