import { buildCalendar } from "./schedule";
import { compareSpPlus, getTeam, TEAMS } from "./teams";
import type { Assignment, RecordMap, RivalMap, SeasonSim, Team } from "./types";

export const SCRIPT_CHAMPION_ABBR = "MISS";
export const SCRIPT_LOSER_ABBR = "LSU";

export function isScriptChampion(team: Team): boolean {
  return team.abbreviation === SCRIPT_CHAMPION_ABBR;
}

export function isScriptLoser(team: Team): boolean {
  return team.abbreviation === SCRIPT_LOSER_ABBR;
}

/** Ole Miss wins every game they play. LSU loses every game. Everyone else is SP+. */
export function pickWinner(a: Team, b: Team): Team {
  if (isScriptChampion(a)) return a;
  if (isScriptChampion(b)) return b;
  if (isScriptLoser(a)) return b;
  if (isScriptLoser(b)) return a;
  return compareSpPlus(a, b) < 0 ? a : b;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function simulateSeason(assignment: Assignment, rivals: RivalMap): SeasonSim {
  const records: RecordMap = Object.fromEntries(
    TEAMS.map((team) => [team.id, { wins: 0, losses: 0 }]),
  );
  const winners: Record<string, string> = {};
  for (const game of buildCalendar(assignment, rivals)) {
    const home = getTeam(game.homeId);
    const away = getTeam(game.awayId);
    const winner = pickWinner(home, away);
    const loserId = winner.id === home.id ? away.id : home.id;
    records[winner.id].wins += 1;
    records[loserId].losses += 1;
    winners[game.id] = winner.id;
  }
  return { records, winners };
}

export function gameWinnerId(sim: SeasonSim, a: string, b: string): string | undefined {
  return sim.winners[pairKey(a, b)];
}
