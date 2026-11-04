import {
  conferenceForTeam,
  teamsInConference,
  type ScenarioConference,
} from "./scenario-conferences";
import {
  percentageAdvantageGroups,
  projectConference,
  type RankedScenarioRow,
  type ScenarioProjection,
} from "./scenario-engine";
import { PLAYOFF_STATUS_LABEL } from "./playoff-race";
import { winningPct, type WinLoss } from "./sunbelt";
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
  // Unresolved computer / CFP / draw groups share a competition place. Assume
  // the selected team wins that tiebreaker, so a CCG place for the group is a path.
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

function tableMates(seed: ScenarioProjection, teamId: string): Set<string> {
  const table = seed.tables.find((item) => item.rows.some((row) => row.teamId === teamId));
  return new Set((table?.rows ?? []).map((row) => row.teamId));
}

function allSeedIds(seed: ScenarioProjection): Set<string> {
  return new Set(seed.tables.flatMap((table) => table.rows.map((row) => row.teamId)));
}

/** Teams competing with `teamId` for its CCG slot: the division, or the whole league. */
function rivalsOf(
  conference: ScenarioConference,
  seed: ScenarioProjection,
  teamId: string,
): Set<string> {
  if (conference.championship === "division-winners") return tableMates(seed, teamId);
  return allSeedIds(seed);
}

function ccgSpots(conference: ScenarioConference): number {
  return conference.championship === "division-winners" ? 1 : 2;
}

function occupants(
  conference: ScenarioConference,
  seed: ScenarioProjection,
  teamId: string,
): Set<string> {
  const rivals = rivalsOf(conference, seed, teamId);
  const spots = ccgSpots(conference);
  const place = placeMap(seed);
  const out = new Set<string>();
  for (const id of rivals) {
    if (id !== teamId && (place.get(id) ?? 99) <= spots) out.add(id);
  }
  return out;
}

/**
 * Best-case remaining results: does *any* path to the CCG still exist?
 * Rivals lose to teams outside the group. Inside the group, current CCG
 * occupants lose to non-occupants; occupant-vs-occupant and trailer-vs-trailer
 * stay unpicked so a H2H trailer is not handed a clinching résumé.
 */
function othersHelp(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  conference: ScenarioConference,
): Record<string, string> {
  const rivals = rivalsOf(conference, seed, teamId);
  const leaders = occupants(conference, seed, teamId);
  const picks: Record<string, string> = {};
  for (const game of remaining) {
    if (involves(game, teamId)) continue;
    const homeRival = rivals.has(game.homeTeamId);
    const awayRival = rivals.has(game.awayTeamId);
    if (homeRival !== awayRival) {
      picks[game.id] = homeRival ? game.awayTeamId : game.homeTeamId;
      continue;
    }
    if (!homeRival) continue;
    const homeLead = leaders.has(game.homeTeamId);
    const awayLead = leaders.has(game.awayTeamId);
    if (homeLead === awayLead) continue;
    picks[game.id] = homeLead ? game.awayTeamId : game.homeTeamId;
  }
  return picks;
}

/**
 * Same-group chaos with outsiders beating rivals. A second best-case attempt
 * so a top-two chaser still has a path when current occupants must lose to
 * each other, without gifting cross-division wins to a H2H trailer.
 */
function othersChaosInGroup(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  conference: ScenarioConference,
): Record<string, string> {
  const rivals = rivalsOf(conference, seed, teamId);
  const place = placeMap(seed);
  const picks: Record<string, string> = {};
  for (const game of remaining) {
    if (involves(game, teamId)) continue;
    const homeRival = rivals.has(game.homeTeamId);
    const awayRival = rivals.has(game.awayTeamId);
    if (homeRival !== awayRival) {
      picks[game.id] = homeRival ? game.awayTeamId : game.homeTeamId;
      continue;
    }
    if (!homeRival) continue;
    const homePlace = place.get(game.homeTeamId) ?? 99;
    const awayPlace = place.get(game.awayTeamId) ?? 99;
    picks[game.id] = homePlace >= awayPlace ? game.homeTeamId : game.awayTeamId;
  }
  return picks;
}

type SpoilMode = "leaders" | "trailers";

/**
 * Feasible worst cases for "win out and there are 0 scenarios they miss the CCG":
 * rivals win every game against outsiders, and inside the group either current
 * leaders keep winning or trailers do (H2H spoiler). Destiny requires both.
 */
function othersSpoil(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  conference: ScenarioConference,
  mode: SpoilMode,
): Record<string, string> {
  const rivals = rivalsOf(conference, seed, teamId);
  const place = placeMap(seed);
  const picks: Record<string, string> = {};
  for (const game of remaining) {
    if (involves(game, teamId)) continue;
    const homeRival = rivals.has(game.homeTeamId);
    const awayRival = rivals.has(game.awayTeamId);
    if (homeRival !== awayRival) {
      picks[game.id] = homeRival ? game.homeTeamId : game.awayTeamId;
      continue;
    }
    if (!homeRival) continue;
    const homePlace = place.get(game.homeTeamId) ?? 99;
    const awayPlace = place.get(game.awayTeamId) ?? 99;
    picks[game.id] =
      mode === "leaders"
        ? homePlace <= awayPlace
          ? game.homeTeamId
          : game.awayTeamId
        : homePlace >= awayPlace
          ? game.homeTeamId
          : game.awayTeamId;
  }
  return picks;
}

function mergePicks(...parts: Record<string, string>[]): Record<string, string> {
  return Object.assign({}, ...parts);
}

function pathOverlays(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  conference: ScenarioConference,
): Record<string, string>[] {
  return [
    othersHelp(teamId, remaining, seed, conference),
    othersChaosInGroup(teamId, remaining, seed, conference),
  ];
}

function spoilOverlays(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  conference: ScenarioConference,
): Record<string, string>[] {
  return [
    othersSpoil(teamId, remaining, seed, conference, "leaders"),
    othersSpoil(teamId, remaining, seed, conference, "trailers"),
  ];
}

function existsCcgPath(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  basePicks: Record<string, string>,
  cfpRanks?: Map<string, number>,
): boolean {
  const inCcg = (overlay: Record<string, string>) =>
    hasCcgPath(
      conference,
      projectWith(conference, teams, games, mergePicks(basePicks, overlay), cfpRanks),
      teamId,
    );
  if (inCcg({})) return true;
  const helpers = pathOverlays(teamId, remaining, seed, conference);
  if (helpers.some(inCcg)) return true;
  const dump = othersDump(teamId, remaining, seed, basePicks, conference);
  if (inCcg(dump)) return true;
  // Dump can leave extra unique teams ahead. Flip leftovers the same way
  // Alive proof does: if any CCG place remains, including an unresolved
  // computer / SportSource pile at #2, the team is not out after a loss.
  for (const start of [dump, ...helpers]) {
    const candidate = greedyImprovePicks(
      conference,
      teams,
      games,
      teamId,
      remaining,
      fillUnpicked(remaining, mergePicks(basePicks, start), seed, "best"),
      cfpRanks,
      "best",
      true,
    );
    if (hasCcgPath(conference, projectWith(conference, teams, games, candidate, cfpRanks), teamId)) {
      return true;
    }
  }
  return false;
}

function guaranteedCcg(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  basePicks: Record<string, string>,
  cfpRanks?: Map<string, number>,
): boolean {
  return spoilOverlays(teamId, remaining, seed, conference).every((overlay) =>
    clinchesCcg(
      conference,
      projectWith(conference, teams, games, mergePicks(basePicks, overlay), cfpRanks),
      teamId,
    ),
  );
}

/** Win-out destiny: still in the CCG field even after both spoil overlays, including unresolved computer/CFP ties. */
function reachesCcgAgainstSpoilers(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  basePicks: Record<string, string>,
  cfpRanks?: Map<string, number>,
): boolean {
  return spoilOverlays(teamId, remaining, seed, conference).every((overlay) =>
    hasCcgPath(
      conference,
      projectWith(conference, teams, games, mergePicks(basePicks, overlay), cfpRanks),
      teamId,
    ),
  );
}

function pathScore(
  conference: ScenarioConference,
  projection: ScenarioProjection,
  teamId: string,
): number {
  const inCcg = hasCcgPath(conference, projection, teamId);
  const place = rowsFor(projection, teamId)[0]?.place ?? 99;
  return (inCcg ? 0 : 100) + place;
}

/** Lower is better for the selected team: unique 1st, then tied 1st, then CCG, then out. */
function placeProofScore(
  conference: ScenarioConference,
  projection: ScenarioProjection,
  teamId: string,
): number {
  const row = rowsFor(projection, teamId)[0];
  const place = row?.place ?? 99;
  const table = projection.tables.find((item) => item.rows.some((entry) => entry.teamId === teamId));
  const tied = table?.rows.filter((entry) => entry.place === place).length ?? 99;
  if (!hasCcgPath(conference, projection, teamId)) return 1000 + place;
  if (place > 1) return 100 + place;
  return tied > 1 ? tied : 0;
}

function chooseOverlay(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  teamId: string,
  basePicks: Record<string, string>,
  overlays: Record<string, string>[],
  prefer: "best" | "worst",
  cfpRanks?: Map<string, number>,
): Record<string, string> {
  let chosen = overlays[0] ?? {};
  let chosenScore = prefer === "best" ? Infinity : -Infinity;
  for (const overlay of overlays) {
    const projection = projectWith(
      conference,
      teams,
      games,
      mergePicks(basePicks, overlay),
      cfpRanks,
    );
    const score = pathScore(conference, projection, teamId);
    if (prefer === "best" ? score < chosenScore : score > chosenScore) {
      chosen = overlay;
      chosenScore = score;
    }
  }
  return chosen;
}

type DumpRecord = { wins: number; losses: number; left: number };

function recordPct(wins: number, losses: number): number {
  return winningPct({ wins, losses, ties: 0 }) ?? -1;
}

function wl(wins: number, losses: number): WinLoss {
  return { wins, losses, ties: 0 };
}

function advantageGroupIndex(records: Map<string, WinLoss>, teamId: string): number {
  const groups = percentageAdvantageGroups(records);
  const index = groups.findIndex((group) => group.includes(teamId));
  return index < 0 ? 99 : index;
}

/** Strictly better in the conference's initial ranking groups — same group is a computer/draw tie. */
function strictlyAhead(
  wins: number,
  losses: number,
  selectedWins: number,
  selectedLosses: number,
  method: ScenarioConference["initialRank"],
): boolean {
  if (method === "losses") return losses < selectedLosses;
  if (method === "percentage-advantage") {
    const records = new Map<string, WinLoss>([
      ["a", wl(wins, losses)],
      ["b", wl(selectedWins, selectedLosses)],
    ]);
    return advantageGroupIndex(records, "a") < advantageGroupIndex(records, "b");
  }
  return recordPct(wins, losses) > recordPct(selectedWins, selectedLosses);
}

function dumpGroupAhead(
  rec: Map<string, DumpRecord>,
  candidateId: string,
  candWins: number,
  candLosses: number,
  selectedId: string,
  selWins: number,
  selLosses: number,
): boolean {
  const records = new Map<string, WinLoss>();
  for (const [id, row] of rec) {
    if (id === candidateId) records.set(id, wl(candWins, candLosses));
    else if (id === selectedId) records.set(id, wl(selWins, selLosses));
    else records.set(id, wl(row.wins, row.losses + row.left));
  }
  return advantageGroupIndex(records, candidateId) < advantageGroupIndex(records, selectedId);
}

/**
 * Best-case others: dump leftover wins onto teams that still cannot finish
 * strictly ahead of the selected team on winning percentage (or losses).
 * A same-percentage SportSource / computer pile is allowed — we assume they
 * win that undetermined tiebreaker.
 */
function othersDump(
  teamId: string,
  remaining: Game[],
  seed: ScenarioProjection,
  ownPicks: Record<string, string>,
  conference: ScenarioConference,
): Record<string, string> {
  const rec = new Map<string, DumpRecord>();
  const ensure = (id: string): DumpRecord => {
    let row = rec.get(id);
    if (!row) {
      row = { wins: 0, losses: 0, left: 0 };
      rec.set(id, row);
    }
    return row;
  };
  for (const table of seed.tables) {
    for (const row of table.rows) {
      rec.set(row.teamId, { wins: row.conf.wins, losses: row.conf.losses, left: 0 });
    }
  }
  for (const game of remaining) {
    ensure(game.homeTeamId).left++;
    ensure(game.awayTeamId).left++;
  }
  const apply = (game: Game, winner: string) => {
    const home = ensure(game.homeTeamId);
    const away = ensure(game.awayTeamId);
    if (winner === game.homeTeamId) {
      home.wins++;
      away.losses++;
    } else {
      away.wins++;
      home.losses++;
    }
    home.left--;
    away.left--;
  };
  for (const game of remaining) {
    const winner = ownPicks[game.id];
    if (winner) apply(game, winner);
  }
  const selected = ensure(teamId);
  const selW = selected.wins;
  const selL = selected.losses;
  const method = conference.initialRank;
  const picks: Record<string, string> = {};
  const others = remaining
    .filter((game) => !involves(game, teamId) && ownPicks[game.id] == null)
    .sort((a, b) => {
      const aMax = Math.max(
        recordPct(ensure(a.homeTeamId).wins, ensure(a.homeTeamId).losses),
        recordPct(ensure(a.awayTeamId).wins, ensure(a.awayTeamId).losses),
      );
      const bMax = Math.max(
        recordPct(ensure(b.homeTeamId).wins, ensure(b.homeTeamId).losses),
        recordPct(ensure(b.awayTeamId).wins, ensure(b.awayTeamId).losses),
      );
      return bMax - aMax || a.id.localeCompare(b.id);
    });
  for (const game of others) {
    const home = ensure(game.homeTeamId);
    const away = ensure(game.awayTeamId);
    const homeWinW = home.wins + 1;
    const homeWinL = home.losses + Math.max(0, home.left - 1);
    const awayWinW = away.wins + 1;
    const awayWinL = away.losses + Math.max(0, away.left - 1);
    const aheadOfSelected = (id: string, wins: number, losses: number) =>
      method === "percentage-advantage"
        ? dumpGroupAhead(rec, id, wins, losses, teamId, selW, selL)
        : strictlyAhead(wins, losses, selW, selL, method);
    const homeSafe = !aheadOfSelected(game.homeTeamId, homeWinW, homeWinL);
    const awaySafe = !aheadOfSelected(game.awayTeamId, awayWinW, awayWinL);
    const homeLocked = aheadOfSelected(
      game.homeTeamId,
      home.wins,
      home.losses + home.left,
    );
    const awayLocked = aheadOfSelected(
      game.awayTeamId,
      away.wins,
      away.losses + away.left,
    );
    let winner: string;
    if (homeSafe !== awaySafe) {
      winner = homeSafe ? game.homeTeamId : game.awayTeamId;
    } else if (homeSafe) {
      const homeLeft = Math.max(0, home.left - 1);
      const awayLeft = Math.max(0, away.left - 1);
      if (homeLeft !== awayLeft) {
        winner = homeLeft < awayLeft ? game.homeTeamId : game.awayTeamId;
      } else if (home.wins !== away.wins) {
        winner = home.wins <= away.wins ? game.homeTeamId : game.awayTeamId;
      } else {
        const homePct = recordPct(homeWinW, homeWinL);
        const awayPct = recordPct(awayWinW, awayWinL);
        winner =
          homePct < awayPct || (homePct === awayPct && home.losses >= away.losses)
            ? game.homeTeamId
            : game.awayTeamId;
      }
    } else if (homeLocked !== awayLocked) {
      winner = homeLocked ? game.homeTeamId : game.awayTeamId;
    } else if (homeWinL !== awayWinL) {
      winner = homeWinL > awayWinL ? game.homeTeamId : game.awayTeamId;
    } else {
      const homePct = recordPct(home.wins, home.losses);
      const awayPct = recordPct(away.wins, away.losses);
      winner = homePct >= awayPct ? game.homeTeamId : game.awayTeamId;
    }
    picks[game.id] = winner;
    apply(game, winner);
  }
  return picks;
}

function fillUnpicked(
  remaining: Game[],
  picks: Record<string, string>,
  seed: ScenarioProjection,
  prefer: "best" | "worst",
): Record<string, string> {
  const place = placeMap(seed);
  const next = { ...picks };
  for (const game of remaining) {
    if (next[game.id]) continue;
    const homePlace = place.get(game.homeTeamId) ?? 99;
    const awayPlace = place.get(game.awayTeamId) ?? 99;
    next[game.id] =
      prefer === "worst"
        ? homePlace <= awayPlace
          ? game.homeTeamId
          : game.awayTeamId
        : homePlace >= awayPlace
          ? game.homeTeamId
          : game.awayTeamId;
  }
  return next;
}

function greedyImprovePicks(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  teamId: string,
  remaining: Game[],
  picks: Record<string, string>,
  cfpRanks: Map<string, number> | undefined,
  prefer: "best" | "worst",
  stopAtCcg = false,
): Record<string, string> {
  const locked = new Set(
    remaining.filter((game) => involves(game, teamId)).map((game) => game.id),
  );
  let current = { ...picks };
  const scoreOf = (next: Record<string, string>) =>
    placeProofScore(conference, projectWith(conference, teams, games, next, cfpRanks), teamId);
  let currentScore = scoreOf(current);
  const done = (score: number) =>
    prefer === "best" && (score === 0 || (stopAtCcg && score < 1000));
  const better = (left: number, right: number) =>
    prefer === "best" ? left < right : left > right;
  for (let pass = 0; pass < 2; pass++) {
    if (done(currentScore)) break;
    for (const game of remaining) {
      if (locked.has(game.id)) continue;
      const home = mergePicks(current, { [game.id]: game.homeTeamId });
      const away = mergePicks(current, { [game.id]: game.awayTeamId });
      const homeScore = scoreOf(home);
      const awayScore = scoreOf(away);
      const useHome = better(homeScore, awayScore) || (homeScore === awayScore && current[game.id] === game.homeTeamId);
      const chosen = useHome ? home : away;
      const chosenScore = useHome ? homeScore : awayScore;
      if (chosen !== current) {
        current = chosen;
        currentScore = chosenScore;
        if (done(currentScore)) return current;
      }
    }
  }
  return current;
}

export function scenarioProofPicks(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  teamId: string,
  options: CcgOptions = {},
): Record<string, string> {
  const extra = options.extraPicks ?? {};
  const seed = projectWith(conference, teams, games, extra, options.cfpRanks);
  const remaining = seed.remainingConference.filter((game) => extra[game.id] == null);
  const row = teamRow(conference, teams, games, teamId, remaining, seed, options);
  const nextGame = row.nextGame;
  const winOwn = winOwnRemaining(teamId, remaining);
  const spoilers = spoilOverlays(teamId, remaining, seed, conference);
  const helpers = [{}, ...pathOverlays(teamId, remaining, seed, conference)];
  const prefer: "best" | "worst" =
    row.status === "eliminated" || row.status === "alive" || row.status === "out-loss"
      ? "best"
      : "worst";
  let own: Record<string, string> = winOwn;
  if (row.status === "clinch" && nextGame) {
    own = mergePicks({ [nextGame.id]: teamId }, loseOwnRemaining(teamId, remaining, nextGame.id));
  } else if ((row.status === "alive" || row.status === "out-loss") && nextGame) {
    own = mergePicks(winOwn, { [nextGame.id]: opponentId(nextGame, teamId) });
  }
  const base = mergePicks(extra, own);
  if (prefer !== "best") {
    const overlay = chooseOverlay(
      conference,
      teams,
      games,
      teamId,
      base,
      spoilers,
      prefer,
      options.cfpRanks,
    );
    return fillUnpicked(remaining, mergePicks(base, overlay), seed, prefer);
  }
  const dump = othersDump(teamId, remaining, seed, base, conference);
  const starts = [dump, ...helpers];
  let best: Record<string, string> | null = null;
  let bestScore = Infinity;
  for (const start of starts) {
    const candidate = greedyImprovePicks(
      conference,
      teams,
      games,
      teamId,
      remaining,
      fillUnpicked(remaining, mergePicks(base, start), seed, prefer),
      options.cfpRanks,
      prefer,
    );
    const score = placeProofScore(
      conference,
      projectWith(conference, teams, games, candidate, options.cfpRanks),
      teamId,
    );
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
      if (bestScore === 0) break;
    }
  }
  return best ?? fillUnpicked(remaining, mergePicks(base, dump), seed, prefer);
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
  const hasPath = existsCcgPath(
    conference,
    teams,
    games,
    teamId,
    remaining,
    seed,
    winOwn,
    options.cfpRanks,
  );
  const clinchesWinOut = reachesCcgAgainstSpoilers(
    conference,
    teams,
    games,
    teamId,
    remaining,
    seed,
    winOwn,
    options.cfpRanks,
  );
  let survivesNextLoss = true;
  if (nextGame) {
    const loseNext = mergePicks(winOwn, { [nextGame.id]: opponentId(nextGame, teamId) });
    survivesNextLoss = existsCcgPath(
      conference,
      teams,
      games,
      teamId,
      remaining,
      seed,
      loseNext,
      options.cfpRanks,
    );
  }
  let clinchesThisWin = false;
  if (nextGame) {
    clinchesThisWin = guaranteedCcg(
      conference,
      teams,
      games,
      teamId,
      remaining,
      seed,
      mergePicks(extra, { [nextGame.id]: teamId }, loseOwnRemaining(teamId, remaining, nextGame.id)),
      options.cfpRanks,
    );
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
  const weekGames = remaining.filter(
    (game) => involves(game, teamId) && (options.week == null || game.week === options.week),
  );
  const out: CcgWeekSwing[] = [];
  for (const game of weekGames) {
    for (const winnerId of [game.homeTeamId, game.awayTeamId]) {
      const nextExtra = mergePicks(extra, { [game.id]: winnerId });
      const afterSeed = projectWith(conference, teams, games, nextExtra, options.cfpRanks);
      const afterRemaining = afterSeed.remainingConference.filter(
        (item) => nextExtra[item.id] == null,
      );
      const after = teamRow(
        conference,
        teams,
        games,
        teamId,
        afterRemaining,
        afterSeed,
        { ...options, extraPicks: nextExtra },
      );
      if (after.status === "eliminated") {
        out.push({ game, winnerId, kind: "eliminates" });
      }
      if (winnerId === teamId) {
        const lock = guaranteedCcg(
          conference,
          teams,
          games,
          teamId,
          remaining,
          seed,
          mergePicks(extra, { [game.id]: teamId }, loseOwnRemaining(teamId, remaining, game.id)),
          options.cfpRanks,
        );
        if (lock) {
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

export function proofPicksCopy(status: CcgStatus, teamName: string): string {
  if (status === "clinch") {
    return `Proof: ${teamName} wins this week, then loses out.`;
  }
  if (status === "destiny") {
    return `Proof: ${teamName} wins out; every other remaining game is a worst case. A computer, CFP, or undetermined tie still counts as controlling their own destiny.`;
  }
  if (status === "alive") {
    return `Proof: ${teamName} loses next, then wins out; every other remaining game is a best case. They still occupy a CCG place, including an unresolved computer / SportSource tie.`;
  }
  if (status === "out-loss") {
    return `Proof: ${teamName} loses next, then wins out; every other remaining game is a best case. Their best finish still misses the CCG.`;
  }
  return `Proof: ${teamName} wins out and everyone else helps; they still miss the CCG.`;
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
    return `${teamName} controls their own destiny: win out and they reach the CCG in every remaining-game scenario, including ties that still need computer rankings, CFP rankings, or another undetermined tiebreaker.`;
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
