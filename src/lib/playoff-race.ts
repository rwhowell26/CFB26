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
import { compareRecords, recordFromGames } from "./ranking-logic";
import type {
  CfpPoll,
  Game,
  PlayoffRaceState,
  PlayoffStatus,
  Team,
} from "./types";

/** Conference champs in the top five auto-bid spots (gold). */
export const AUTO_BID_IN_COUNT = 5;
/** Extra CCG winners listed after the five auto bids (red). */
export const AUTO_BID_OUT_COUNT = 5;
/** At-large spots shown in CFP gold. */
export const AT_LARGE_IN_COUNT = 7;
/** Overall losses allowed for the at-large pool. */
export const AT_LARGE_MAX_LOSSES = 3;

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
  games: Game[] = [],
  cfp: CfpPoll = { published: false, week: null, weekLabel: null, ranks: [] },
): { conference: number; autoBid: number; eliminated: number } {
  const champs = new Set(autoBidTeams(teams, games, cfp, state).map((team) => team.id));
  const atLarge = new Set(atLargePoolTeams(teams, state, cfp, games).map((team) => team.id));
  const ccgLosers = championshipLoserIds(games);
  const playoffOut = new Set(state.playoffEliminatedIds);
  let conference = 0;
  let autoBid = champs.size;
  let eliminated = 0;
  for (const team of teams) {
    if (champs.has(team.id) || atLarge.has(team.id)) continue;
    if (isIndependentConference(team.conference)) {
      if (
        isUConn(team) ||
        isNotreDame(team) ||
        playoffOut.has(team.id) ||
        teamPlayoffStatus(state, team) === "eliminated"
      ) {
        eliminated += 1;
      }
      continue;
    }
    if (
      playoffOut.has(team.id) ||
      teamPlayoffStatus(state, team) === "eliminated" ||
      cannotMakeCcg(team, state, games, ccgLosers)
    ) {
      eliminated += 1;
      continue;
    }
    conference += 1;
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

function isConferenceLedgerGame(game: Game): boolean {
  return Boolean(game.conferenceGame) && !game.championshipGame;
}

/** Finals after the seed date that still need Apply to count. */
export function isPendingPlayoffGame(game: Game, state: PlayoffRaceState): boolean {
  if (game.championshipGame) return false;
  if (game.status !== "final" || gameWinnerId(game) == null) return false;
  if (state.appliedGameIds.includes(game.id)) return false;
  if (game.date.slice(0, 10) <= PLAYOFF_SEED_AS_OF) return false;
  return true;
}

export function applyConferenceGame(
  state: PlayoffRaceState,
  game: Game,
  ndId?: string,
): PlayoffRaceState {
  if (state.appliedGameIds.includes(game.id)) return state;
  const winnerId = gameWinnerId(game);
  if (!winnerId) return state;
  const loserId = winnerId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
  const records = isConferenceLedgerGame(game)
    ? {
        ...state.records,
        [winnerId]: bumpRecord(state.records[winnerId], "wins", 1),
        [loserId]: bumpRecord(state.records[loserId], "losses", 1),
      }
    : state.records;
  let notreDameRecord = state.notreDameRecord;
  if (ndId && (winnerId === ndId || loserId === ndId)) {
    notreDameRecord = bumpRecord(
      notreDameRecord,
      winnerId === ndId ? "wins" : "losses",
      1,
    );
  }
  return {
    ...state,
    appliedGameIds: [...state.appliedGameIds, game.id],
    records,
    notreDameRecord,
  };
}

export function undoLastAppliedGame(
  state: PlayoffRaceState,
  games: Game[],
  ndId?: string,
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
  const records = isConferenceLedgerGame(game)
    ? {
        ...state.records,
        [winnerId]: bumpRecord(state.records[winnerId], "wins", -1),
        [loserId]: bumpRecord(state.records[loserId], "losses", -1),
      }
    : state.records;
  let notreDameRecord = state.notreDameRecord;
  if (ndId && (winnerId === ndId || loserId === ndId)) {
    notreDameRecord = bumpRecord(
      notreDameRecord,
      winnerId === ndId ? "wins" : "losses",
      -1,
    );
  }
  return {
    ...state,
    appliedGameIds: state.appliedGameIds.slice(0, -1),
    records,
    notreDameRecord,
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
  const champIds = new Set(autoBidTeams(teams, games, cfp, state).map((team) => team.id));
  const ccgLosers = championshipLoserIds(games);
  const atLargeIds = new Set(
    atLargePoolTeams(teams, state, cfp, games).map((team) => team.id),
  );
  const ranks = cfpRankMap(cfp);
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
        if (champIds.has(team.id) || atLargeIds.has(team.id)) continue;
        const status = teamPlayoffStatus(state, team);
        if (status === "eliminated" || cannotMakeCcg(team, state, games, ccgLosers)) {
          eliminated.push(team);
        } else {
          standing.push(team);
        }
      }
      standing.sort((a, b) => compareStandings(a, b, state, ranks));
      eliminated.sort((a, b) => compareEliminated(a, b, state));
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

function standingStatusGroup(status: PlayoffStatus): number {
  if (status === "destiny") return 0;
  if (status === "out-loss") return 2;
  if (status === "eliminated") return 3;
  return 1;
}

function compareStandings(
  a: Team,
  b: Team,
  state: PlayoffRaceState,
  ranks: Map<string, number>,
): number {
  const as = standingStatusGroup(teamPlayoffStatus(state, a));
  const bs = standingStatusGroup(teamPlayoffStatus(state, b));
  if (as !== bs) return as - bs;
  const ar = conferenceRecord(state, a.id);
  const br = conferenceRecord(state, b.id);
  if (ar.losses !== br.losses) return ar.losses - br.losses;
  const rankA = ranks.get(a.id) ?? 99;
  const rankB = ranks.get(b.id) ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name);
}

function compareEliminated(a: Team, b: Team, state: PlayoffRaceState): number {
  const da = state.eliminatedOn?.[a.id] ?? "";
  const db = state.eliminatedOn?.[b.id] ?? "";
  if (da !== db) return db.localeCompare(da);
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

export function overallPlayoffRecord(
  team: Team,
  state: PlayoffRaceState,
  games: Game[],
): { wins: number; losses: number } {
  const live = recordFromGames(team.id, games);
  if (live.wins + live.losses > 0) return live;
  if (isNotreDame(team)) return state.notreDameRecord;
  return live;
}

/** Soonest unplayed game for a team, including games in progress. */
export function nextGameForTeam(teamId: string, games: Game[]): Game | null {
  const upcoming = games
    .filter((game) => {
      if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) return false;
      return game.status !== "final";
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.week - b.week);
  return upcoming[0] ?? null;
}

export function formatNextOpponent(
  game: Game,
  teamId: string,
  teamsById: Map<string, Team>,
  ranks: Map<string, number> = new Map(),
): string {
  const isHome = game.homeTeamId === teamId;
  const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
  const opponent = teamsById.get(opponentId);
  const name = opponent?.abbreviation || (isHome ? game.awayName : game.homeName);
  const rank = ranks.get(opponentId);
  const ranked = rank != null ? `#${rank} ${name}` : name;
  const loc = game.neutralSite ? "vs" : isHome ? "vs" : "@";
  if (game.status === "in_progress") return `${loc} ${ranked} · live`;
  const when = formatPlayoffLossDate(game.date);
  return when ? `${loc} ${ranked} · ${when}` : `${loc} ${ranked}`;
}

export function championshipLoserIds(games: Game[]): Set<string> {
  const losers = new Set<string>();
  for (const game of games) {
    if (!game.championshipGame || game.status !== "final") continue;
    const winnerId = gameWinnerId(game);
    if (!winnerId) continue;
    losers.add(winnerId === game.homeTeamId ? game.awayTeamId : game.homeTeamId);
  }
  return losers;
}

function cannotMakeCcg(
  team: Team,
  state: PlayoffRaceState,
  games: Game[] = [],
  losers: Set<string> = championshipLoserIds(games),
): boolean {
  if (isIndependentConference(team.conference)) return true;
  if (teamPlayoffStatus(state, team) === "eliminated") return true;
  return losers.has(team.id);
}

export function pendingAtLargeGames(
  games: Game[],
  state: PlayoffRaceState,
  atLargeIds: Set<string>,
): Game[] {
  return games
    .filter((game) => {
      if (!isPendingPlayoffGame(game, state)) return false;
      return atLargeIds.has(game.homeTeamId) || atLargeIds.has(game.awayTeamId);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.week - b.week);
}

/** One CCG winner per conference, from final championship games. Empty until CCG weekend. */
export function conferenceChampions(teams: Team[], games: Game[]): Team[] {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const byConf = new Map<string, { team: Team; date: string }>();
  for (const game of games) {
    if (!game.championshipGame || game.status !== "final") continue;
    const winnerId = gameWinnerId(game);
    if (!winnerId) continue;
    const winner = byId.get(winnerId);
    if (!winner || isIndependentConference(winner.conference)) continue;
    const key = parentKey(winner);
    const prev = byConf.get(key);
    if (!prev || game.date > prev.date) byConf.set(key, { team: winner, date: game.date });
  }
  return [...byConf.values()].map((row) => row.team);
}

export function autoBidTeams(
  teams: Team[],
  games: Game[],
  cfp: CfpPoll,
  state: PlayoffRaceState = emptyPlayoffRace(),
): Team[] {
  const out = new Set(state.playoffEliminatedIds);
  const ranks = cfpRankMap(cfp);
  return conferenceChampions(teams, games)
    .filter((team) => !out.has(team.id))
    .sort((a, b) => {
      const ar = ranks.get(a.id);
      const br = ranks.get(b.id);
      if (ar != null && br != null && ar !== br) return ar - br;
      if (ar != null && br == null) return -1;
      if (ar == null && br != null) return 1;
      const rec = compareRecords(
        recordFromGames(a.id, games),
        recordFromGames(b.id, games),
      );
      if (rec !== 0) return rec;
      return a.name.localeCompare(b.name);
    });
}

/** CCG-out (or independent) teams with 3 or fewer overall losses, ranked by CFP. */
export function atLargePoolTeams(
  teams: Team[],
  state: PlayoffRaceState,
  cfp: CfpPoll,
  games: Game[],
): Team[] {
  const champs = new Set(autoBidTeams(teams, games, cfp, state).map((team) => team.id));
  const out = new Set(state.playoffEliminatedIds);
  const pool: Team[] = [];
  for (const team of teams) {
    if (out.has(team.id) || champs.has(team.id)) continue;
    if (!cannotMakeCcg(team, state, games)) continue;
    if (overallPlayoffRecord(team, state, games).losses > AT_LARGE_MAX_LOSSES) continue;
    pool.push(team);
  }
  const ranks = cfpRankMap(cfp);
  return pool.sort((a, b) => {
    const ar = ranks.get(a.id);
    const br = ranks.get(b.id);
    if (ar != null && br != null && ar !== br) return ar - br;
    if (ar != null && br == null) return -1;
    if (ar == null && br != null) return 1;
    const rec = compareRecords(
      overallPlayoffRecord(a, state, games),
      overallPlayoffRecord(b, state, games),
    );
    if (rec !== 0) return rec;
    return a.name.localeCompare(b.name);
  });
}

export function independentEliminated(
  teams: Team[],
  state: PlayoffRaceState,
  games: Game[] = [],
): Team[] {
  const out = new Set(state.playoffEliminatedIds);
  return teams
    .filter((team) => {
      if (!isIndependentConference(team.conference)) return false;
      if (isUConn(team)) return true;
      if (isNotreDame(team)) {
        return (
          out.has(team.id) ||
          overallPlayoffRecord(team, state, games).losses > AT_LARGE_MAX_LOSSES
        );
      }
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
