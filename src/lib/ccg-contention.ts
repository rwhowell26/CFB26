import {
  conferenceForTeam,
  teamsInConference,
  type ScenarioConference,
} from "./scenario-conferences";
import {
  projectConference,
  type RankedScenarioRow,
  type ScenarioProjection,
} from "./scenario-engine";
import { PLAYOFF_STATUS_LABEL } from "./playoff-race";
import type { Game, Team } from "./types";

export type CcgStatus = "clinch" | "destiny" | "alive" | "out-loss" | "eliminated";

export const CCG_STATUS_LABEL: Record<CcgStatus, string> = {
  clinch: "Clinch",
  destiny: PLAYOFF_STATUS_LABEL.destiny,
  alive: PLAYOFF_STATUS_LABEL.alive,
  "out-loss": PLAYOFF_STATUS_LABEL["out-loss"],
  eliminated: PLAYOFF_STATUS_LABEL.eliminated,
};

export type CcgTeamContention = {
  teamId: string;
  status: CcgStatus;
  nextGame: Game | null;
  hasPath: boolean;
  clinchesWinOut: boolean;
  clinchesThisWin: boolean;
  survivesNextLoss: boolean;
};

export type CcgElimGame = {
  game: Game;
  eliminatesIf: { winnerId: string; teamIds: string[] };
};

export type CcgWeekSwing = {
  game: Game;
  winnerId: string;
  kind: "eliminates" | "clinches";
};

export type CcgGameImplication = {
  winnerId: string;
  winnerName: string;
  statusByTeam: Record<string, CcgStatus>;
  newlyEliminated: string[];
  newlyOutWithLoss: string[];
  newlyDestiny: string[];
  newlyClinch: string[];
};

export type ConferenceContention = {
  conference: ScenarioConference;
  byTeam: Map<string, CcgTeamContention>;
};

export type CcgOptions = {
  cfpRanks?: Map<string, number>;
  week?: number;
  extraPicks?: Record<string, string>;
};

function involves(game: Game, teamId: string): boolean {
  return game.homeTeamId === teamId || game.awayTeamId === teamId;
}

function opponentId(game: Game, teamId: string): string {
  return game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
}

function rowsFor(projection: ScenarioProjection, teamId: string): RankedScenarioRow[] {
  return projection.tables.flatMap((table) => table.rows.filter((row) => row.teamId === teamId));
}

function hasCcgPath(
  conference: ScenarioConference,
  projection: ScenarioProjection,
  teamId: string,
): boolean {
  const rows = rowsFor(projection, teamId);
  if (!rows.length) return false;
  if (conference.championship === "division-winners") {
    return rows.some((row) => row.place === 1);
  }
  return rows.some((row) => row.place <= 2);
}

function clinchesCcg(
  conference: ScenarioConference,
  projection: ScenarioProjection,
  teamId: string,
): boolean {
  if (conference.championship === "division-winners") {
    const table = projection.tables.find((item) =>
      item.rows.some((row) => row.teamId === teamId),
    );
    if (!table) return false;
    const row = table.rows.find((item) => item.teamId === teamId);
    if (!row || row.place !== 1) return false;
    return table.rows.filter((item) => item.place === 1).length === 1;
  }
  const rows = projection.tables[0]?.rows ?? [];
  const row = rows.find((item) => item.teamId === teamId);
  if (!row || row.place > 2) return false;
  const firsts = rows.filter((item) => item.place === 1);
  if (row.place === 1) return firsts.length <= 2;
  return rows.filter((item) => item.place <= 2).length <= 2;
}

function nextConferenceGame(teamId: string, remaining: Game[], week?: number): Game | null {
  const own = remaining.filter((game) => involves(game, teamId));
  if (!own.length) return null;
  const thisWeek = week != null ? own.filter((game) => game.week === week) : own;
  const pool = thisWeek.length ? thisWeek : own;
  return [...pool].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0] ?? null;
}

function winOwnRemaining(teamId: string, remaining: Game[]): Record<string, string> {
  const picks: Record<string, string> = {};
  for (const game of remaining) {
    if (involves(game, teamId)) picks[game.id] = teamId;
  }
  return picks;
}

function placeMap(seed: ScenarioProjection): Map<string, number> {
  const place = new Map<string, number>();
  for (const table of seed.tables) {
    for (const row of table.rows) place.set(row.teamId, row.place);
  }
  return place;
}

function othersKeepWinning(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
): Record<string, string> {
  const place = placeMap(seed);
  const picks: Record<string, string> = {};
  for (const game of remaining) {
    if (involves(game, teamId)) continue;
    const homePlace = place.get(game.homeTeamId) ?? 99;
    const awayPlace = place.get(game.awayTeamId) ?? 99;
    picks[game.id] = homePlace <= awayPlace ? game.homeTeamId : game.awayTeamId;
  }
  return picks;
}

/**
 * Same-table "chaos": currently worse-placed teams win remaining games.
 * Used for top-two leagues, where every conference game is inside one standings table.
 */
function othersFall(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
): Record<string, string> {
  const place = placeMap(seed);
  const picks: Record<string, string> = {};
  for (const game of remaining) {
    if (involves(game, teamId)) continue;
    const homePlace = place.get(game.homeTeamId) ?? 99;
    const awayPlace = place.get(game.awayTeamId) ?? 99;
    picks[game.id] = homePlace >= awayPlace ? game.homeTeamId : game.awayTeamId;
  }
  return picks;
}

function tableMates(seed: ScenarioProjection, teamId: string): Set<string> {
  const table = seed.tables.find((item) => item.rows.some((row) => row.teamId === teamId));
  return new Set((table?.rows ?? []).map((row) => row.teamId));
}

/**
 * Best-case remaining results for "does a path still exist?".
 *
 * Division races: same-division teams lose to the other division; intra-division
 * games stay unpicked so a trailer is not handed a table-clinching résumé
 * (the App State / Georgia St false out-with-a-loss).
 *
 * Top-two races: fall back to othersFall, because every remaining conference
 * game is inside the same table and leaders must lose for a chaser to have a path.
 */
function othersHelp(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  conference: ScenarioConference,
): Record<string, string> {
  if (conference.championship !== "division-winners") {
    return othersFall(teamId, remaining, seed);
  }
  const rivals = tableMates(seed, teamId);
  const picks: Record<string, string> = {};
  for (const game of remaining) {
    if (involves(game, teamId)) continue;
    const homeRival = rivals.has(game.homeTeamId);
    const awayRival = rivals.has(game.awayTeamId);
    if (homeRival === awayRival) continue;
    picks[game.id] = homeRival ? game.awayTeamId : game.homeTeamId;
  }
  return picks;
}

function mergePicks(...parts: Record<string, string>[]): Record<string, string> {
  return Object.assign({}, ...parts);
}

function projectWith(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  picks: Record<string, string>,
  cfpRanks?: Map<string, number>,
): ScenarioProjection {
  return projectConference(conference, teams, games, { picks, cfpRanks });
}

function loseOwnRemaining(
  teamId: string,
  remaining: Game[],
  exceptId?: string,
): Record<string, string> {
  const picks: Record<string, string> = {};
  for (const game of remaining) {
    if (game.id === exceptId || !involves(game, teamId)) continue;
    picks[game.id] = opponentId(game, teamId);
  }
  return picks;
}

function statusFor(args: {
  hasPath: boolean;
  clinchesThisWin: boolean;
  clinchesWinOut: boolean;
  survivesLoss: boolean;
  nextGame: Game | null;
}): CcgStatus {
  if (!args.hasPath) return "eliminated";
  if (args.clinchesThisWin) return "clinch";
  if (args.clinchesWinOut) return "destiny";
  if (args.nextGame && !args.survivesLoss) return "out-loss";
  return "alive";
}

function teamRow(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  options: CcgOptions,
): CcgTeamContention {
  const extra = options.extraPicks ?? {};
  const nextGame = nextConferenceGame(teamId, remaining, options.week);
  const winOwn = mergePicks(winOwnRemaining(teamId, remaining), extra);
  const helpOthers = othersHelp(teamId, remaining, seed, conference);
  const best = projectWith(
    conference,
    teams,
    games,
    mergePicks(winOwn, helpOthers),
    options.cfpRanks,
  );
  const worst = projectWith(
    conference,
    teams,
    games,
    mergePicks(winOwn, othersKeepWinning(teamId, remaining, seed)),
    options.cfpRanks,
  );
  let survivesNextLoss = true;
  if (nextGame) {
    const loseNext = mergePicks(
      winOwn,
      helpOthers,
      { [nextGame.id]: opponentId(nextGame, teamId) },
    );
    const afterLoss = projectWith(conference, teams, games, loseNext, options.cfpRanks);
    survivesNextLoss = hasCcgPath(conference, afterLoss, teamId);
  }
  const hasPath = hasCcgPath(conference, best, teamId);
  const clinchesWinOut = clinchesCcg(conference, worst, teamId);
  let clinchesThisWin = false;
  if (nextGame) {
    const afterThisWin = projectWith(
      conference,
      teams,
      games,
      mergePicks(
        extra,
        { [nextGame.id]: teamId },
        loseOwnRemaining(teamId, remaining, nextGame.id),
        othersKeepWinning(teamId, remaining, seed),
      ),
      options.cfpRanks,
    );
    clinchesThisWin = clinchesCcg(conference, afterThisWin, teamId);
  }
  return {
    teamId,
    status: statusFor({
      hasPath,
      clinchesThisWin,
      clinchesWinOut,
      survivesLoss: survivesNextLoss,
      nextGame,
    }),
    nextGame,
    hasPath,
    clinchesWinOut,
    clinchesThisWin,
    survivesNextLoss,
  };
}

export function conferenceContention(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  options: CcgOptions = {},
): ConferenceContention {
  const members = teamsInConference(teams, conference);
  const extra = options.extraPicks ?? {};
  const seed = projectWith(conference, teams, games, extra, options.cfpRanks);
  const remaining = seed.remainingConference.filter((game) => extra[game.id] == null);
  const byTeam = new Map<string, CcgTeamContention>();
  for (const team of members) {
    byTeam.set(team.id, teamRow(conference, teams, games, team.id, remaining, seed, options));
  }
  return { conference, byTeam };
}

export function eliminationGamesThisWeek(
  conference: ScenarioConference,
  teamId: string,
  teams: Team[],
  games: Game[],
  options: CcgOptions = {},
): CcgElimGame[] {
  return weekSwingsThisWeek(conference, teamId, teams, games, options)
    .filter((item) => item.kind === "eliminates")
    .map((item) => ({
      game: item.game,
      eliminatesIf: { winnerId: item.winnerId, teamIds: [teamId] },
    }));
}

export function weekSwingsThisWeek(
  conference: ScenarioConference,
  teamId: string,
  teams: Team[],
  games: Game[],
  options: CcgOptions = {},
): CcgWeekSwing[] {
  const extra = options.extraPicks ?? {};
  const seed = projectWith(conference, teams, games, extra, options.cfpRanks);
  const remaining = seed.remainingConference.filter((game) => extra[game.id] == null);
  const baseline = teamRow(conference, teams, games, teamId, remaining, seed, options);
  if (baseline.status === "eliminated") return [];
  const weekGames = remaining.filter((game) => options.week == null || game.week === options.week);
  const out: CcgWeekSwing[] = [];
  for (const game of weekGames) {
    for (const winnerId of [game.homeTeamId, game.awayTeamId]) {
      const after = teamRow(
        conference,
        teams,
        games,
        teamId,
        remaining.filter((item) => item.id !== game.id),
        seed,
        { ...options, extraPicks: mergePicks(extra, { [game.id]: winnerId }) },
      );
      if (after.status === "eliminated") {
        out.push({ game, winnerId, kind: "eliminates" });
      }
      if (winnerId === teamId) {
        const lock = projectWith(
          conference,
          teams,
          games,
          mergePicks(
            extra,
            { [game.id]: teamId },
            loseOwnRemaining(teamId, remaining, game.id),
            othersKeepWinning(teamId, remaining, seed),
          ),
          options.cfpRanks,
        );
        if (clinchesCcg(conference, lock, teamId)) {
          out.push({ game, winnerId, kind: "clinches" });
        }
      }
    }
  }
  return out;
}

export function allConferenceContention(
  teams: Team[],
  games: Game[],
  options: CcgOptions = {},
): Map<string, ConferenceContention> {
  const seen = new Set<string>();
  const out = new Map<string, ConferenceContention>();
  for (const team of teams) {
    const conference = conferenceForTeam(team);
    if (!conference || seen.has(conference.id)) continue;
    seen.add(conference.id);
    out.set(conference.id, conferenceContention(conference, teams, games, options));
  }
  return out;
}

export function teamContention(
  team: Team,
  teams: Team[],
  games: Game[],
  options: CcgOptions = {},
): CcgTeamContention | null {
  const conference = conferenceForTeam(team);
  if (!conference) return null;
  return conferenceContention(conference, teams, games, options).byTeam.get(team.id) ?? null;
}

export function gameImplications(
  game: Game,
  teams: Team[],
  games: Game[],
  options: CcgOptions = {},
): { conference: ScenarioConference; outcomes: CcgGameImplication[] } | null {
  const home = teams.find((team) => team.id === game.homeTeamId);
  const away = teams.find((team) => team.id === game.awayTeamId);
  const conference = home ? conferenceForTeam(home) : null;
  const awayConf = away ? conferenceForTeam(away) : null;
  if (!conference || !awayConf || conference.id !== awayConf.id || game.championshipGame) {
    return null;
  }
  const baseline = conferenceContention(conference, teams, games, options);
  const nameOf = (id: string) => teams.find((team) => team.id === id)?.shortName ?? id;
  const outcomes: CcgGameImplication[] = [];
  for (const winnerId of [game.awayTeamId, game.homeTeamId]) {
    const next = conferenceContention(conference, teams, games, {
      ...options,
      extraPicks: mergePicks(options.extraPicks ?? {}, { [game.id]: winnerId }),
    });
    const statusByTeam: Record<string, CcgStatus> = {};
    const newlyEliminated: string[] = [];
    const newlyOutWithLoss: string[] = [];
    const newlyDestiny: string[] = [];
    const newlyClinch: string[] = [];
    for (const [teamId, row] of next.byTeam) {
      statusByTeam[teamId] = row.status;
      const prev = baseline.byTeam.get(teamId)?.status;
      if (prev !== "eliminated" && row.status === "eliminated") newlyEliminated.push(teamId);
      if (prev !== "out-loss" && row.status === "out-loss") newlyOutWithLoss.push(teamId);
      if (prev !== "destiny" && row.status === "destiny") newlyDestiny.push(teamId);
      if (prev !== "clinch" && row.status === "clinch") newlyClinch.push(teamId);
    }
    outcomes.push({
      winnerId,
      winnerName: nameOf(winnerId),
      statusByTeam,
      newlyEliminated,
      newlyOutWithLoss,
      newlyDestiny,
      newlyClinch,
    });
  }
  return { conference, outcomes };
}

export function contentionCopy(row: CcgTeamContention, teamName: string): string {
  if (row.status === "eliminated") {
    return `${teamName} is eliminated from the conference championship game.`;
  }
  if (row.status === "clinch") {
    const opp = row.nextGame
      ? row.nextGame.homeTeamId === row.teamId
        ? row.nextGame.awayName
        : row.nextGame.homeName
      : "this week";
    const loss = row.survivesNextLoss
      ? ""
      : " A loss eliminates them.";
    return `${teamName} clinches a CCG berth with a win over ${opp}.${loss}`;
  }
  if (row.status === "destiny") {
    return `${teamName} controls their own destiny: win out and they reach the CCG regardless of other results.`;
  }
  if (row.status === "out-loss") {
    const opp = row.nextGame
      ? row.nextGame.homeTeamId === row.teamId
        ? row.nextGame.awayName
        : row.nextGame.homeName
      : "their next conference game";
    return `${teamName} can still reach the CCG, but a loss to ${opp} eliminates them.`;
  }
  if (row.survivesNextLoss) {
    return `${teamName} can still reach the CCG, including if they lose their next conference game.`;
  }
  return `${teamName} still has a path to the CCG.`;
}
