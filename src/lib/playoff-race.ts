import {
  isIndependentConference,
  normalizeConferenceName,
  playoffTableLabel,
  playoffTableSortKey,
} from "./conferences";
import {
  PLAYOFF_NOTRE_DAME_SEED,
  PLAYOFF_SEED_AS_OF,
  PLAYOFF_SEED_VERSION,
  PLAYOFF_TEAM_SEED,
} from "./playoff-race-seed";
import type {
  CfpPoll,
  Game,
  PlayoffRaceState,
  PlayoffStatus,
  Team,
} from "./types";

export { PLAYOFF_SEED_VERSION } from "./playoff-race-seed";

export const PLAYOFF_STATUSES: PlayoffStatus[] = [
  "alive",
  "destiny",
  "out-loss",
  "eliminated",
];

export const PLAYOFF_STATUS_LABEL: Record<PlayoffStatus, string> = {
  destiny: "Control destiny",
  alive: "Alive",
  "out-loss": "Out with a loss",
  eliminated: "Eliminated",
};

export function emptyPlayoffRace(): PlayoffRaceState {
  return {
    records: {},
    status: {},
    appliedGameIds: [],
    notreDameRecord: { wins: 0, losses: 0 },
    playoffEliminatedIds: [],
    eliminatedOn: {},
    seedVersion: 0,
  };
}

export function hydratePlayoffSeed(
  state: PlayoffRaceState,
  games: Game[],
): PlayoffRaceState {
  if ((state.seedVersion ?? 0) >= PLAYOFF_SEED_VERSION) return state;

  const records: PlayoffRaceState["records"] = {};
  const status: PlayoffRaceState["status"] = {};
  for (const [id, row] of Object.entries(PLAYOFF_TEAM_SEED)) {
    records[id] = { wins: row.wins, losses: row.losses };
    status[id] = row.status;
  }

  return fillEliminatedDates(
    {
      records,
      status,
      appliedGameIds: pendingConferenceGames(games, emptyPlayoffRace())
        .filter((game) => game.date.slice(0, 10) <= PLAYOFF_SEED_AS_OF)
        .map((game) => game.id),
      notreDameRecord: { ...PLAYOFF_NOTRE_DAME_SEED },
      playoffEliminatedIds: [],
      eliminatedOn: {},
      seedVersion: PLAYOFF_SEED_VERSION,
    },
    games,
  );
}

export function isNotreDame(team: Team): boolean {
  return /notre dame/i.test(team.name) || team.abbreviation === "ND";
}

export function isUConn(team: Team): boolean {
  return /connecticut|\buconn\b/i.test(team.name);
}

export function conferenceRecord(
  state: PlayoffRaceState,
  teamId: string,
): { wins: number; losses: number } {
  return state.records[teamId] ?? { wins: 0, losses: 0 };
}

export function teamPlayoffStatus(
  state: PlayoffRaceState,
  team: Team,
): PlayoffStatus {
  if (isUConn(team)) return "eliminated";
  return state.status[team.id] ?? "alive";
}

export function playoffContentionCounts(
  teams: Team[],
  state: PlayoffRaceState,
): { conference: number; autoBid: number; eliminated: number } {
  let conference = 0;
  let autoBid = 0;
  let eliminated = 0;
  const playoffOut = new Set(state.playoffEliminatedIds);
  for (const team of teams) {
    const status = teamPlayoffStatus(state, team);
    if (isNotreDame(team)) {
      if (status === "eliminated" || playoffOut.has(team.id)) eliminated += 1;
      continue;
    }
    if (status === "eliminated") {
      eliminated += 1;
      continue;
    }
    if (isIndependentConference(team.conference)) continue;
    conference += 1;
    if (status === "destiny") autoBid += 1;
  }
  return { conference, autoBid, eliminated };
}

export function nextPlayoffStatus(current: PlayoffStatus): PlayoffStatus {
  const idx = PLAYOFF_STATUSES.indexOf(current);
  return PLAYOFF_STATUSES[(idx + 1) % PLAYOFF_STATUSES.length];
}

function bumpRecord(
  current: { wins: number; losses: number } | undefined,
  field: "wins" | "losses",
  delta: number,
): { wins: number; losses: number } {
  const next = { wins: current?.wins ?? 0, losses: current?.losses ?? 0 };
  next[field] = Math.max(0, next[field] + delta);
  return next;
}

export function setNotreDameRecord(
  state: PlayoffRaceState,
  field: "wins" | "losses",
  delta: number,
): PlayoffRaceState {
  return {
    ...state,
    notreDameRecord: bumpRecord(state.notreDameRecord, field, delta),
  };
}

export function adjustConferenceRecord(
  state: PlayoffRaceState,
  teamId: string,
  field: "wins" | "losses",
  delta: number,
): PlayoffRaceState {
  return {
    ...state,
    records: {
      ...state.records,
      [teamId]: bumpRecord(state.records[teamId], field, delta),
    },
  };
}

export function cycleTeamStatus(
  state: PlayoffRaceState,
  team: Team,
  games: Game[] = [],
): PlayoffRaceState {
  if (isUConn(team)) return state;
  const current = teamPlayoffStatus(state, team);
  const next = nextPlayoffStatus(current);
  const playoffEliminatedIds =
    next === "eliminated"
      ? state.playoffEliminatedIds
      : state.playoffEliminatedIds.filter((id) => id !== team.id);
  const eliminatedOn = { ...(state.eliminatedOn ?? {}) };
  if (next === "eliminated") {
    const played = lastPlayedDate(games, team.id);
    if (played) eliminatedOn[team.id] = played;
  } else {
    delete eliminatedOn[team.id];
  }
  return {
    ...state,
    status: { ...state.status, [team.id]: next },
    playoffEliminatedIds,
    eliminatedOn,
  };
}

export function eliminateFromAtLarge(
  state: PlayoffRaceState,
  teamId: string,
  games: Game[] = [],
): PlayoffRaceState {
  if (state.playoffEliminatedIds.includes(teamId)) return state;
  const eliminatedOn = { ...(state.eliminatedOn ?? {}) };
  const played = lastPlayedDate(games, teamId);
  if (played) eliminatedOn[teamId] = played;
  return {
    ...state,
    status: { ...state.status, [teamId]: "eliminated" },
    playoffEliminatedIds: [...state.playoffEliminatedIds, teamId],
    eliminatedOn,
  };
}

export function setEliminatedOn(
  state: PlayoffRaceState,
  teamId: string,
  date: string,
): PlayoffRaceState {
  const trimmed = date.trim();
  const eliminatedOn = { ...(state.eliminatedOn ?? {}) };
  if (!trimmed) delete eliminatedOn[teamId];
  else eliminatedOn[teamId] = trimmed;
  return { ...state, eliminatedOn };
}

/** Fill missing knockout dates from each team's last played final. */
export function fillEliminatedDates(
  state: PlayoffRaceState,
  games: Game[],
): PlayoffRaceState {
  const eliminatedOn = { ...(state.eliminatedOn ?? {}) };
  let changed = !state.eliminatedOn;
  for (const [id, status] of Object.entries(state.status)) {
    if (status !== "eliminated" || eliminatedOn[id]) continue;
    const played = lastPlayedDate(games, id);
    if (!played) continue;
    eliminatedOn[id] = played;
    changed = true;
  }
  if (!changed) return state;
  return { ...state, eliminatedOn };
}

export function restoreToAtLarge(
  state: PlayoffRaceState,
  teamId: string,
): PlayoffRaceState {
  return {
    ...state,
    playoffEliminatedIds: state.playoffEliminatedIds.filter((id) => id !== teamId),
  };
}

export function gameWinnerId(game: Game): string | null {
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore === game.awayScore) return null;
  return game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
}

export function pendingConferenceGames(
  games: Game[],
  state: PlayoffRaceState,
): Game[] {
  const applied = new Set(state.appliedGameIds);
  return games
    .filter((game) => {
      if (!game.conferenceGame || game.championshipGame) return false;
      if (game.status !== "final" || !game.homeIsFbs || !game.awayIsFbs) return false;
      if (applied.has(game.id)) return false;
      const homeOut = state.status[game.homeTeamId] === "eliminated";
      const awayOut = state.status[game.awayTeamId] === "eliminated";
      if (homeOut && awayOut) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.week - b.week);
}

export function groupPendingGames(
  games: Game[],
  teamsById: Map<string, Team>,
): Array<{ conference: string; label: string; games: Game[] }> {
  const groups = new Map<string, Game[]>();
  for (const game of games) {
    const home = teamsById.get(game.homeTeamId);
    const key =
      game.conferenceGroup ||
      (home ? normalizeConferenceName(home.conference) : "Conference");
    const list = groups.get(key) ?? [];
    list.push(game);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .map(([conference, list]) => ({
      conference,
      label: playoffTableLabel(conference),
      games: list,
    }))
    .sort((a, b) => playoffTableSortKey(a.conference) - playoffTableSortKey(b.conference));
}

export function applyConferenceGame(
  state: PlayoffRaceState,
  game: Game,
): PlayoffRaceState {
  if (state.appliedGameIds.includes(game.id)) return state;
  const winnerId = gameWinnerId(game);
  if (!winnerId) return state;
  const loserId = winnerId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
  return {
    ...state,
    appliedGameIds: [...state.appliedGameIds, game.id],
    records: {
      ...state.records,
      [winnerId]: bumpRecord(state.records[winnerId], "wins", 1),
      [loserId]: bumpRecord(state.records[loserId], "losses", 1),
    },
  };
}

export function undoLastAppliedGame(
  state: PlayoffRaceState,
  games: Game[],
): PlayoffRaceState {
  const gameId = state.appliedGameIds[state.appliedGameIds.length - 1];
  if (!gameId) return state;
  const game = games.find((item) => item.id === gameId);
  if (!game) {
    return { ...state, appliedGameIds: state.appliedGameIds.slice(0, -1) };
  }
  const winnerId = gameWinnerId(game);
  if (!winnerId) {
    return { ...state, appliedGameIds: state.appliedGameIds.slice(0, -1) };
  }
  const loserId = winnerId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
  return {
    ...state,
    appliedGameIds: state.appliedGameIds.slice(0, -1),
    records: {
      ...state.records,
      [winnerId]: bumpRecord(state.records[winnerId], "wins", -1),
      [loserId]: bumpRecord(state.records[loserId], "losses", -1),
    },
  };
}

export type PlayoffTable = {
  conference: string;
  label: string;
  gamesInSeason: number;
  standing: Team[];
  eliminated: Team[];
};

export function playoffTables(
  teams: Team[],
  state: PlayoffRaceState,
  cfp: CfpPoll,
  games: Game[],
): PlayoffTable[] {
  const ranked = new Set(cfp.ranks.map((row) => row.teamId));
  const playoffOut = new Set(state.playoffEliminatedIds);
  const confGames = games.filter(
    (game) => game.conferenceGame && !game.championshipGame && game.homeIsFbs && game.awayIsFbs,
  );

  const groups = new Map<string, Team[]>();
  for (const team of teams) {
    if (isIndependentConference(team.conference)) continue;
    const list = groups.get(team.conference) ?? [];
    list.push(team);
    groups.set(team.conference, list);
  }

  return Array.from(groups.entries())
    .map(([conference, members]) => {
      const standing: Team[] = [];
      const eliminated: Team[] = [];
      for (const team of members) {
        const status = teamPlayoffStatus(state, team);
        if (status !== "eliminated") {
          standing.push(team);
          continue;
        }
        if (ranked.has(team.id) && !playoffOut.has(team.id)) continue;
        eliminated.push(team);
      }
      standing.sort((a, b) => compareStandings(a, b, state));
      eliminated.sort((a, b) => compareStandings(a, b, state));
      const gamesInSeason = Math.max(
        0,
        ...members.map((team) =>
          confGames.filter(
            (game) => game.homeTeamId === team.id || game.awayTeamId === team.id,
          ).length,
        ),
      );
      return {
        conference,
        label: playoffTableLabel(conference),
        gamesInSeason,
        standing,
        eliminated,
      };
    })
    .sort((a, b) => playoffTableSortKey(a.conference) - playoffTableSortKey(b.conference));
}

function winPct(record: { wins: number; losses: number }): number {
  const played = record.wins + record.losses;
  return played === 0 ? 0 : record.wins / played;
}

function compareStandings(a: Team, b: Team, state: PlayoffRaceState): number {
  const ar = conferenceRecord(state, a.id);
  const br = conferenceRecord(state, b.id);
  const ap = winPct(ar);
  const bp = winPct(br);
  if (ap !== bp) return bp - ap;
  if (ar.wins !== br.wins) return br.wins - ar.wins;
  if (ar.losses !== br.losses) return ar.losses - br.losses;
  return a.name.localeCompare(b.name);
}

/** Chicago calendar date of the team's most recent final. */
export function lastPlayedDate(games: Game[], teamId: string): string | null {
  let latest: string | null = null;
  for (const game of games) {
    if (game.status !== "final") continue;
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;
    if (!latest || game.date > latest) latest = game.date;
  }
  return latest ? toChicagoYmd(latest) : null;
}

function toChicagoYmd(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export function formatPlayoffLossDate(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (match) return `${Number(match[2])}/${Number(match[3])}`;
  const date = new Date(ymd);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

export function pendingGamesForConference(
  pending: Game[],
  conference: string,
  teamsById: Map<string, Team>,
): Game[] {
  return pending.filter((game) => {
    const home = teamsById.get(game.homeTeamId);
    const away = teamsById.get(game.awayTeamId);
    return home?.conference === conference || away?.conference === conference;
  });
}

export function cfpRankMap(cfp: CfpPoll): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of cfp.ranks) map.set(row.teamId, row.rank);
  return map;
}

export function parentKey(team: Team): string {
  return normalizeConferenceName(team.conference);
}

/** Highest CFP-ranked team still in each conference race. */
export function projectedChampions(
  teams: Team[],
  state: PlayoffRaceState,
  cfp: CfpPoll,
): Team[] {
  const ranks = cfpRankMap(cfp);
  const byParent = new Map<string, Team[]>();
  for (const team of teams) {
    if (isIndependentConference(team.conference)) continue;
    if (teamPlayoffStatus(state, team) === "eliminated") continue;
    const key = parentKey(team);
    const list = byParent.get(key) ?? [];
    list.push(team);
    byParent.set(key, list);
  }

  const champs: Team[] = [];
  for (const members of byParent.values()) {
    const ranked = members
      .filter((team) => ranks.has(team.id))
      .sort((a, b) => (ranks.get(a.id) ?? 99) - (ranks.get(b.id) ?? 99));
    if (ranked[0]) champs.push(ranked[0]);
  }
  return champs.sort((a, b) => (ranks.get(a.id) ?? 99) - (ranks.get(b.id) ?? 99));
}

export function autoBidTeams(
  teams: Team[],
  state: PlayoffRaceState,
  cfp: CfpPoll,
): Team[] {
  return projectedChampions(teams, state, cfp).slice(0, 5);
}

export function atLargeFieldTeams(
  teams: Team[],
  state: PlayoffRaceState,
  cfp: CfpPoll,
  autoBidIds: Set<string>,
): Team[] {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const out = new Set(state.playoffEliminatedIds);
  const picked: Team[] = [];
  for (const row of [...cfp.ranks].sort((a, b) => a.rank - b.rank)) {
    if (autoBidIds.has(row.teamId) || out.has(row.teamId)) continue;
    const team = byId.get(row.teamId);
    if (!team) continue;
    picked.push(team);
    if (picked.length >= 7) break;
  }
  return picked;
}

/** Ranked teams knocked out of their conference race, plus Notre Dame. */
export function atLargePoolTeams(
  teams: Team[],
  state: PlayoffRaceState,
  cfp: CfpPoll,
): Team[] {
  const ranked = new Set(cfp.ranks.map((row) => row.teamId));
  const out = new Set(state.playoffEliminatedIds);
  const pool: Team[] = [];
  for (const team of teams) {
    if (out.has(team.id)) continue;
    if (isNotreDame(team)) {
      pool.push(team);
      continue;
    }
    if (isIndependentConference(team.conference)) continue;
    if (teamPlayoffStatus(state, team) !== "eliminated") continue;
    if (!ranked.has(team.id)) continue;
    pool.push(team);
  }
  const ranks = cfpRankMap(cfp);
  return pool.sort((a, b) => {
    const ar = ranks.get(a.id);
    const br = ranks.get(b.id);
    if (ar != null && br != null) return ar - br;
    if (ar != null) return -1;
    if (br != null) return 1;
    if (isNotreDame(a)) return -1;
    if (isNotreDame(b)) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function independentEliminated(
  teams: Team[],
  state: PlayoffRaceState,
): Team[] {
  const out = new Set(state.playoffEliminatedIds);
  return teams
    .filter((team) => {
      if (!isIndependentConference(team.conference)) return false;
      if (isUConn(team)) return true;
      if (isNotreDame(team)) return out.has(team.id);
      return teamPlayoffStatus(state, team) === "eliminated" || out.has(team.id);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function conferenceGamesForTeam(games: Game[], teamId: string): number {
  return games.filter(
    (game) =>
      game.conferenceGame &&
      !game.championshipGame &&
      (game.homeTeamId === teamId || game.awayTeamId === teamId),
  ).length;
}
