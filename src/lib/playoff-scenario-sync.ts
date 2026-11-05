import { allConferenceContention, type CcgStatus } from "./ccg-contention";
import {
  applyConferenceGame,
  cfpRankMap,
  lastPlayedDate,
  undoLastAppliedGame,
} from "./playoff-race";
import type { CfpPoll, Game, PlayoffRaceState, PlayoffStatus, Team } from "./types";

export function ccgStatusToPlayoff(status: CcgStatus): PlayoffStatus {
  return status === "clinch" ? "destiny" : status;
}

function mapsEqual(
  left: Record<string, string> | undefined,
  right: Record<string, string> | undefined,
): boolean {
  const a = left ?? {};
  const b = right ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** Rewrite every conference team's Playoff category from CCG scenarios. */
export function syncPlayoffStatuses(
  state: PlayoffRaceState,
  teams: Team[],
  games: Game[],
  cfp?: CfpPoll,
): PlayoffRaceState {
  const cfpRanks = cfp?.ranks.length ? cfpRankMap(cfp) : undefined;
  const judged = new Set(state.playoffEliminatedIds);
  const status: PlayoffRaceState["status"] = { ...state.status };
  const eliminatedOn = { ...(state.eliminatedOn ?? {}) };

  for (const [, contention] of allConferenceContention(teams, games, { cfpRanks })) {
    for (const [teamId, row] of contention.byTeam) {
      if (judged.has(teamId)) {
        status[teamId] = "eliminated";
        continue;
      }
      const next = ccgStatusToPlayoff(row.status);
      const prev = status[teamId];
      status[teamId] = next;
      if (next === "eliminated") {
        if (prev !== "eliminated" && !eliminatedOn[teamId]) {
          const played = lastPlayedDate(games, teamId);
          if (played) eliminatedOn[teamId] = played;
        }
      } else {
        delete eliminatedOn[teamId];
      }
    }
  }

  if (mapsEqual(state.status, status) && mapsEqual(state.eliminatedOn, eliminatedOn)) {
    return state;
  }
  return { ...state, status, eliminatedOn };
}

export function applyPlayoffGame(
  state: PlayoffRaceState,
  game: Game,
  teams: Team[],
  games: Game[],
  ndId?: string,
  cfp?: CfpPoll,
): PlayoffRaceState {
  return syncPlayoffStatuses(applyConferenceGame(state, game, ndId), teams, games, cfp);
}

export function undoPlayoffGame(
  state: PlayoffRaceState,
  teams: Team[],
  games: Game[],
  ndId?: string,
  cfp?: CfpPoll,
): PlayoffRaceState {
  return syncPlayoffStatuses(undoLastAppliedGame(state, games, ndId), teams, games, cfp);
}
