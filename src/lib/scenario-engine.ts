import { isArmyNavyGame } from "./game-overrides";
import {
  SCENARIO_CONFERENCES,
  conferenceForTeam,
  type RoundRobinMode,
  type ScenarioConference,
  type TiebreakStep,
  teamsInConference,
} from "./scenario-conferences";
import {
  competitionPlaces,
  conferenceRecord,
  formatWinLoss,
  markTieGroup,
  projectSunBelt,
  winningPct,
  type RankedSunBeltRow,
  type WinLoss,
} from "./sunbelt";
import type { Game, Team } from "./types";

export type RankedScenarioRow = {
  teamId: string;
  place: number;
  conf: WinLoss;
  division: WinLoss | null;
  fbs: WinLoss;
  champion: boolean;
  titleGame: boolean;
  tieNote: string | null;
  unresolved: boolean;
};

export type ScenarioTable = {
  id: string;
  label: string;
  rows: RankedScenarioRow[];
  champExplanation: string;
};

export type ScenarioChampionship = {
  homeId: string | null;
  awayId: string | null;
  note: string;
};

export type ScenarioProjection = {
  conference: ScenarioConference;
  tables: ScenarioTable[];
  championship: ScenarioChampionship;
  completedConference: Game[];
  remainingConference: Game[];
  unpickedCount: number;
};

export type ScenarioOptions = {
  picks?: Record<string, string>;
  cfpRanks?: Map<string, number>;
};

type ResolvedGame = {
  id: string;
  week: number;
  date: string;
  homeId: string;
  awayId: string;
  winnerId: string | null;
  tie: boolean;
};

type Ctx = {
  conference: ScenarioConference;
  teamIds: string[];
  games: ResolvedGame[];
  allGames: Game[];
  byTeam: Map<string, ResolvedGame[]>;
  cfpRanks: Map<string, number> | null;
  finalWeek: number;
  nameFor: (id: string) => string;
  fbsOf: (id: string) => WinLoss;
};

function emptyWl(): WinLoss {
  return { wins: 0, losses: 0, ties: 0 };
}

function gameWinner(game: Game): { winnerId: string | null; tie: boolean } | null {
  if (game.status !== "final") return null;
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore === game.awayScore) return { winnerId: null, tie: true };
  return {
    winnerId: game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId,
    tie: false,
  };
}

export function conferenceGamesFor(
  games: Game[],
  teamIds: Set<string>,
): Game[] {
  return games
    .filter(
      (game) =>
        !game.championshipGame &&
        !isArmyNavyGame(game) &&
        teamIds.has(game.homeTeamId) &&
        teamIds.has(game.awayTeamId),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function involves(game: ResolvedGame, teamId: string): boolean {
  return game.homeId === teamId || game.awayId === teamId;
}

function opponentId(game: ResolvedGame, teamId: string): string {
  return game.homeId === teamId ? game.awayId : game.homeId;
}

function addResult(record: WinLoss, game: ResolvedGame, teamId: string): void {
  if (game.tie) {
    record.ties += 1;
    return;
  }
  if (game.winnerId === teamId) record.wins += 1;
  else record.losses += 1;
}

function recordAgainst(teamId: string, opponents: Set<string>, ctx: Ctx): WinLoss {
  const record = emptyWl();
  for (const game of ctx.byTeam.get(teamId) ?? []) {
    const opp = opponentId(game, teamId);
    if (!opponents.has(opp)) continue;
    addResult(record, game, teamId);
  }
  return record;
}

function gamesPlayed(record: WinLoss): number {
  return record.wins + record.losses + record.ties;
}

function fbsRecord(teamId: string, games: Game[], resolvedConf: ResolvedGame[]): WinLoss {
  const counted = new Set(resolvedConf.map((game) => game.id));
  const record = emptyWl();
  for (const game of games) {
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;
    const isHome = game.homeTeamId === teamId;
    if (!(isHome ? game.awayIsFbs : game.homeIsFbs)) continue;
    if (counted.has(game.id)) {
      const resolved = resolvedConf.find((item) => item.id === game.id);
      if (resolved) addResult(record, resolved, teamId);
      continue;
    }
    if (game.status !== "final" || game.homeScore == null || game.awayScore == null) continue;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;
    if (teamScore === oppScore) record.ties += 1;
    else if (teamScore > oppScore) record.wins += 1;
    else record.losses += 1;
  }
  return record;
}

function resolveGames(
  games: Game[],
  teamIds: Set<string>,
  picks: Record<string, string>,
): ResolvedGame[] {
  const resolved: ResolvedGame[] = [];
  for (const game of conferenceGamesFor(games, teamIds)) {
    const actual = gameWinner(game);
    if (actual) {
      resolved.push({
        id: game.id,
        week: game.week,
        date: game.date,
        homeId: game.homeTeamId,
        awayId: game.awayTeamId,
        winnerId: actual.winnerId,
        tie: actual.tie,
      });
      continue;
    }
    const pick = picks[game.id];
    if (pick === game.homeTeamId || pick === game.awayTeamId) {
      resolved.push({
        id: game.id,
        week: game.week,
        date: game.date,
        homeId: game.homeTeamId,
        awayId: game.awayTeamId,
        winnerId: pick,
        tie: false,
      });
    }
  }
  return resolved;
}

function groupByKey<T>(items: T[], keyOf: (item: T) => string): T[][] {
  const groups: T[][] = [];
  const index = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    let group = index.get(key);
    if (!group) {
      group = [];
      index.set(key, group);
      groups.push(group);
    }
    group.push(item);
  }
  return groups;
}

function pctKey(record: WinLoss): string {
  const pct = winningPct(record);
  return pct == null ? "none" : pct.toFixed(6);
}

/**
 * ACC 2026: order by winning percentage, then pull in any team that played a
 * different number of conference games and matches the group's wins or losses.
 * A 5-4 (9 games) and 4-4 (8 games) are the same CCG tie group.
 */
export function percentageAdvantageGroups(records: Map<string, WinLoss>): string[][] {
  const remaining = new Set(records.keys());
  const groups: string[][] = [];
  const playedOf = (id: string) => {
    const record = records.get(id)!;
    return record.wins + record.losses + record.ties;
  };
  while (remaining.size) {
    let bestPct = -2;
    for (const id of remaining) {
      const pct = winningPct(records.get(id)!) ?? -1;
      if (pct > bestPct) bestPct = pct;
    }
    const best = bestPct < 0 ? "none" : bestPct.toFixed(6);
    const core: string[] = [];
    for (const id of remaining) {
      if (pctKey(records.get(id)!) === best) core.push(id);
    }
    const attached: string[] = [];
    for (const id of remaining) {
      if (core.includes(id)) continue;
      const rec = records.get(id)!;
      const played = playedOf(id);
      const matches = core.some((cid) => {
        const corePlayed = playedOf(cid);
        if (played === 0 || corePlayed === 0 || corePlayed === played) return false;
        const cr = records.get(cid)!;
        return rec.wins === cr.wins || rec.losses === cr.losses;
      });
      if (matches) attached.push(id);
    }
    const group = [...core, ...attached];
    groups.push(group);
    for (const id of group) remaining.delete(id);
  }
  return groups;
}

function initialGroups(teamIds: string[], ctx: Ctx): string[][] {
  const method = ctx.conference.initialRank;
  const sortGroup = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ar = conferenceRecord(a, ctx.games);
      const br = conferenceRecord(b, ctx.games);
      if (method === "losses") {
        if (ar.losses !== br.losses) return ar.losses - br.losses;
        if (ar.wins !== br.wins) return br.wins - ar.wins;
      } else {
        const ap = winningPct(ar) ?? -1;
        const bp = winningPct(br) ?? -1;
        if (ap !== bp) return bp - ap;
        if (method === "percentage-advantage" || method === "record-advantage") {
          if (ar.wins !== br.wins) return br.wins - ar.wins;
        }
      }
      return ctx.nameFor(a).localeCompare(ctx.nameFor(b));
    });
  if (method === "percentage-advantage") {
    const records = new Map(teamIds.map((id) => [id, conferenceRecord(id, ctx.games)]));
    return percentageAdvantageGroups(records).map(sortGroup);
  }
  const sorted = sortGroup(teamIds);
  return groupByKey(sorted, (id) => {
    const record = conferenceRecord(id, ctx.games);
    if (method === "losses") return `L${record.losses}`;
    return pctKey(record);
  });
}

function roundRobinRecord(teamId: string, group: string[], ctx: Ctx): WinLoss {
  return recordAgainst(teamId, new Set(group.filter((id) => id !== teamId)), ctx);
}

function hasSweepWin(teamId: string, group: string[], ctx: Ctx): boolean {
  const others = group.filter((id) => id !== teamId);
  if (!others.length) return false;
  for (const opp of others) {
    const record = recordAgainst(teamId, new Set([opp]), ctx);
    if (record.wins === 0 || record.losses > 0) return false;
  }
  return true;
}

function hasSweepLoss(teamId: string, group: string[], ctx: Ctx): boolean {
  const others = group.filter((id) => id !== teamId);
  if (!others.length) return false;
  for (const opp of others) {
    const record = recordAgainst(teamId, new Set([opp]), ctx);
    if (record.losses === 0 || record.wins > 0) return false;
  }
  return true;
}

function roundRobinScore(
  teamId: string,
  group: string[],
  ctx: Ctx,
  mode: RoundRobinMode,
): number | null {
  const record = roundRobinRecord(teamId, group, ctx);
  const played = group.map((id) => gamesPlayed(roundRobinRecord(id, group, ctx)));
  const equalGames = new Set(played).size === 1 && played[0] > 0;
  const sweepWin = hasSweepWin(teamId, group, ctx);
  const anySweepWin = group.some((id) => hasSweepWin(id, group, ctx));
  const sweepLoss = hasSweepLoss(teamId, group, ctx);
  const anySweepLoss = group.some((id) => hasSweepLoss(id, group, ctx));

  if (mode === "unequal") return winningPct(record);
  if (mode === "equal") return equalGames ? winningPct(record) : null;
  if (mode === "equal-or-sweep-win") {
    if (anySweepWin) return sweepWin ? 1 : 0;
    return equalGames ? winningPct(record) : null;
  }
  if (anySweepWin || anySweepLoss) {
    if (sweepWin) return 2;
    if (sweepLoss) return 0;
    return 1;
  }
  return equalGames ? winningPct(record) : null;
}

function playedOpponents(teamId: string, ctx: Ctx): Set<string> {
  const opps = new Set<string>();
  for (const game of ctx.byTeam.get(teamId) ?? []) opps.add(opponentId(game, teamId));
  return opps;
}

function commonConferenceOpponents(group: string[], ctx: Ctx): Set<string> {
  const played = group.map((id) => playedOpponents(id, ctx));
  const first = played[0];
  if (!first) return new Set();
  const common = new Set<string>();
  for (const opp of first) {
    if (group.includes(opp)) continue;
    if (played.every((set) => set.has(opp))) common.add(opp);
  }
  return common;
}

function commonOpponentsScore(teamId: string, group: string[], ctx: Ctx): number | null {
  const common = commonConferenceOpponents(group, ctx);
  if (!common.size) return null;
  return winningPct(recordAgainst(teamId, common, ctx));
}

function standingsWalkScore(
  teamId: string,
  group: string[],
  ctx: Ctx,
  above: string[],
  below: string[][],
  oneGameEach: boolean,
): number | null {
  const slots = [
    ...above.map((id) => [id]),
    ...below.filter((slot) => slot.some((id) => !group.includes(id))),
  ];
  for (const slot of slots) {
    const records = group.map((id) => recordAgainst(id, new Set(slot), ctx));
    if (records.some((record) => gamesPlayed(record) === 0)) continue;
    if (oneGameEach && records.some((record) => gamesPlayed(record) !== 1)) continue;
    const pcts = records.map((record) => winningPct(record));
    if (pcts.every((pct) => pct == null)) continue;
    if (new Set(pcts.map((pct) => (pct == null ? "skip" : pct.toFixed(6)))).size === 1) continue;
    return winningPct(recordAgainst(teamId, new Set(slot), ctx));
  }
  return null;
}

function opponentWinPct(teamId: string, ctx: Ctx): number | null {
  const opps = new Set<string>();
  for (const game of ctx.byTeam.get(teamId) ?? []) opps.add(opponentId(game, teamId));
  if (!opps.size) return null;
  let wins = 0;
  let played = 0;
  for (const opp of opps) {
    const record = conferenceRecord(opp, ctx.games);
    wins += record.wins + record.ties * 0.5;
    played += gamesPlayed(record);
  }
  return played ? wins / played : null;
}

function eligibleTotalWins(teamId: string, ctx: Ctx): number {
  const fbsWins = ctx.fbsOf(teamId).wins;
  let fcsWins = 0;
  for (const game of ctx.allGames) {
    if (game.status !== "final" || game.homeScore == null || game.awayScore == null) continue;
    const isHome = game.homeTeamId === teamId;
    if (!isHome && game.awayTeamId !== teamId) continue;
    const oppIsFbs = isHome ? game.awayIsFbs : game.homeIsFbs;
    if (oppIsFbs) continue;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;
    if (teamScore > oppScore) fcsWins += 1;
  }
  return fbsWins + Math.min(1, fcsWins);
}

function finalWeekendResult(teamId: string, ctx: Ctx): "win" | "loss" | "tie" | "none" {
  const games = (ctx.byTeam.get(teamId) ?? []).filter((game) => game.week === ctx.finalWeek);
  if (!games.length) return "none";
  const last = games[games.length - 1];
  if (last.tie) return "tie";
  return last.winnerId === teamId ? "win" : "loss";
}

function cfpScore(
  teamId: string,
  group: string[],
  ctx: Ctx,
  requireFinalWin: boolean,
  immunity: boolean,
): number | null {
  if (!ctx.cfpRanks || ctx.cfpRanks.size === 0) return null;
  const ranked = group
    .filter((id) => ctx.cfpRanks!.has(id))
    .sort((a, b) => (ctx.cfpRanks!.get(a) ?? 99) - (ctx.cfpRanks!.get(b) ?? 99));
  if (!ranked.length) return null;
  const highest = ranked[0];
  const result = finalWeekendResult(highest, ctx);
  if (immunity && result !== "loss") {
    return teamId === highest ? 1 : 0;
  }
  if (requireFinalWin && result !== "win") return null;
  return teamId === highest ? 1 : 0;
}

function stepScore(
  step: TiebreakStep,
  teamId: string,
  group: string[],
  ctx: Ctx,
  above: string[],
  below: string[][],
): number | null {
  switch (step.kind) {
    case "round-robin":
      return roundRobinScore(teamId, group, ctx, step.roundRobin ?? "equal");
    case "division-pct":
      return winningPct(conferenceRecord(teamId, ctx.games));
    case "standings-walk":
      return standingsWalkScore(teamId, group, ctx, above, below, Boolean(step.oneGameEach));
    case "common-opponents":
      return commonOpponentsScore(teamId, group, ctx);
    case "conf-record-equal": {
      const records = group.map((id) => conferenceRecord(id, ctx.games));
      if (new Set(records.map(gamesPlayed)).size !== 1) return null;
      return winningPct(conferenceRecord(teamId, ctx.games));
    }
    case "opponent-win-pct":
      return opponentWinPct(teamId, ctx);
    case "total-wins":
      return eligibleTotalWins(teamId, ctx);
    case "overall-pct":
      return winningPct(ctx.fbsOf(teamId));
    case "cfp-final-weekend":
      return cfpScore(teamId, group, ctx, true, false);
    case "cfp-rank":
      return cfpScore(teamId, group, ctx, false, Boolean(step.immunity));
    case "draw":
      return null;
  }
}

type RankResult = {
  order: string[];
  notes: Map<string, string>;
  unresolved: Set<string>;
  tieGroups: Map<string, string>;
  explanation: string[];
};

function bucketsFor(
  group: string[],
  step: TiebreakStep,
  ctx: Ctx,
  above: string[],
  below: string[][],
): string[][] | null {
  const scores = group.map((id) => stepScore(step, id, group, ctx, above, below));
  if (scores.every((score) => score == null)) return null;
  const keys = scores.map((score) => (score == null ? "none" : score.toFixed(8)));
  if (new Set(keys).size === 1) return null;
  const ordered = [...group].sort((a, b) => {
    const sa = stepScore(step, a, group, ctx, above, below);
    const sb = stepScore(step, b, group, ctx, above, below);
    const na = sa == null ? -1 : sa;
    const nb = sb == null ? -1 : sb;
    if (na !== nb) return nb - na;
    return ctx.nameFor(a).localeCompare(ctx.nameFor(b));
  });
  return groupByKey(ordered, (id) => {
    const score = stepScore(step, id, group, ctx, above, below);
    return score == null ? "none" : score.toFixed(8);
  });
}

function resolveGroup(
  group: string[],
  ctx: Ctx,
  above: string[],
  below: string[][],
  notes: Map<string, string>,
  unresolved: Set<string>,
  tieGroups: Map<string, string>,
  explanation: string[],
  twoTeam: boolean,
): string[] {
  if (group.length <= 1) return group;
  const played = group.some((id) => gamesPlayed(conferenceRecord(id, ctx.games)) > 0);
  if (!played) {
    return [...group].sort((a, b) => ctx.nameFor(a).localeCompare(ctx.nameFor(b)));
  }
  const steps =
    twoTeam && ctx.conference.twoTeamSteps?.length
      ? ctx.conference.twoTeamSteps
      : ctx.conference.steps;
  const names = group.map((id) => ctx.nameFor(id)).join(", ");
  for (const step of steps) {
    if (step.kind === "draw") {
      const ordered = [...group].sort((a, b) => ctx.nameFor(a).localeCompare(ctx.nameFor(b)));
      markTieGroup(ordered, unresolved, tieGroups);
      for (const id of ordered) {
        notes.set(id, `Unresolved ${ctx.conference.drawSource.toLowerCase()} / coin toss (${names}).`);
      }
      explanation.push(`Tie among ${names} reaches ${ctx.conference.drawSource.toLowerCase()} (not applied here).`);
      return ordered;
    }
    if (twoTeam && ctx.conference.twoTeamH2hFirst && step.kind !== "round-robin") {
      const h2h = ctx.conference.steps.find((item) => item.kind === "round-robin");
      if (h2h) {
        const h2hBuckets = bucketsFor(group, h2h, ctx, above, below);
        if (h2hBuckets) {
          return flattenBuckets(
            h2hBuckets,
            h2h,
            ctx,
            above,
            below,
            notes,
            unresolved,
            tieGroups,
            explanation,
            true,
          );
        }
      }
    }
    const buckets = bucketsFor(group, step, ctx, above, below);
    if (!buckets) continue;
    explanation.push(`Tie among ${names} broken on ${step.label}.`);
    return flattenBuckets(
      buckets,
      step,
      ctx,
      above,
      below,
      notes,
      unresolved,
      tieGroups,
      explanation,
      twoTeam,
    );
  }
  const leftover = [...group].sort((a, b) => ctx.nameFor(a).localeCompare(ctx.nameFor(b)));
  markTieGroup(leftover, unresolved, tieGroups);
  return leftover;
}

function flattenBuckets(
  buckets: string[][],
  step: TiebreakStep,
  ctx: Ctx,
  above: string[],
  below: string[][],
  notes: Map<string, string>,
  unresolved: Set<string>,
  tieGroups: Map<string, string>,
  explanation: string[],
  twoTeam: boolean,
): string[] {
  const ordered: string[] = [];
  const remainingBelow = buckets.slice(1);
  for (const [index, bucket] of buckets.entries()) {
    if (bucket.length === 1) {
      if (index === 0) notes.set(bucket[0], `Won the tie on ${step.label}.`);
      ordered.push(bucket[0]);
      if (ctx.conference.onlySplitOnePerStep && index === 0 && buckets.length > 1) {
        const rest = buckets.slice(1).flat();
        ordered.push(
          ...resolveGroup(
            rest,
            ctx,
            [...above, ...ordered],
            remainingBelow,
            notes,
            unresolved,
            tieGroups,
            explanation,
            rest.length === 2 && ctx.conference.returnToTwoTeam,
          ),
        );
        break;
      }
      continue;
    }
    const nextTwo = bucket.length === 2 && ctx.conference.returnToTwoTeam;
    ordered.push(
      ...resolveGroup(
        bucket,
        ctx,
        [...above, ...ordered],
        remainingBelow,
        notes,
        unresolved,
        tieGroups,
        explanation,
        nextTwo || twoTeam,
      ),
    );
  }
  return ordered;
}

function rankTeams(teamIds: string[], ctx: Ctx): RankResult {
  const notes = new Map<string, string>();
  const unresolved = new Set<string>();
  const tieGroups = new Map<string, string>();
  const explanation: string[] = [];
  const groups = initialGroups(teamIds, ctx);
  const order: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const below = groups.slice(i + 1);
    if (group.length === 1) {
      order.push(group[0]);
      continue;
    }
    order.push(
      ...resolveGroup(
        group,
        ctx,
        order,
        below,
        notes,
        unresolved,
        tieGroups,
        explanation,
        group.length === 2,
      ),
    );
  }
  return { order, notes, unresolved, tieGroups, explanation };
}

function fromSunBeltRow(row: RankedSunBeltRow, titleGame: boolean): RankedScenarioRow {
  return {
    teamId: row.teamId,
    place: row.place,
    conf: row.conf,
    division: row.division,
    fbs: row.fbs,
    champion: row.champion,
    titleGame,
    tieNote: row.tieNote,
    unresolved: row.unresolved,
  };
}

export function projectConference(
  conference: ScenarioConference,
  teams: Team[],
  games: Game[],
  options: ScenarioOptions = {},
): ScenarioProjection {
  if (conference.id === "sunbelt") {
    const sun = projectSunBelt(teams, games, {
      picks: options.picks,
      cfpRanks: options.cfpRanks,
    });
    return {
      conference,
      tables: [
        {
          id: "east",
          label: "East",
          rows: sun.east.rows.map((row) => fromSunBeltRow(row, row.champion)),
          champExplanation: sun.east.champExplanation,
        },
        {
          id: "west",
          label: "West",
          rows: sun.west.rows.map((row) => fromSunBeltRow(row, row.champion)),
          champExplanation: sun.west.champExplanation,
        },
      ],
      championship: {
        homeId: sun.championship.hostId,
        awayId:
          sun.championship.hostId === sun.championship.eastId
            ? sun.championship.westId
            : sun.championship.eastId,
        note: sun.championship.hostNote,
      },
      completedConference: sun.completedConference,
      remainingConference: sun.remainingConference,
      unpickedCount: sun.unpickedCount,
    };
  }

  const members = teamsInConference(teams, conference);
  const teamIds = members.map((team) => team.id);
  const idSet = new Set(teamIds);
  const picks = options.picks ?? {};
  const confGames = conferenceGamesFor(games, idSet);
  const resolved = resolveGames(games, idSet, picks);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const nameFor = (id: string) => teamsById.get(id)?.shortName ?? id;
  const fbsCache = new Map<string, WinLoss>();
  const fbsOf = (id: string) => {
    const hit = fbsCache.get(id);
    if (hit) return hit;
    const record = fbsRecord(id, games, resolved);
    fbsCache.set(id, record);
    return record;
  };
  const byTeam = new Map<string, ResolvedGame[]>();
  for (const game of resolved) {
    for (const id of [game.homeId, game.awayId]) {
      const list = byTeam.get(id) ?? [];
      list.push(game);
      byTeam.set(id, list);
    }
  }
  const weeks = resolved.map((game) => game.week);
  const ctx: Ctx = {
    conference,
    teamIds,
    games: resolved,
    allGames: games,
    byTeam,
    cfpRanks: options.cfpRanks && options.cfpRanks.size > 0 ? options.cfpRanks : null,
    finalWeek: weeks.length ? Math.max(...weeks) : 0,
    nameFor,
    fbsOf,
  };
  const ranked = rankTeams(teamIds, ctx);
  const places = competitionPlaces(ranked.order.length, (index) => {
    const current = ranked.tieGroups.get(ranked.order[index]!);
    const previous = ranked.tieGroups.get(ranked.order[index - 1]!);
    return current != null && current === previous;
  });
  const rows: RankedScenarioRow[] = ranked.order.map((teamId, index) => ({
    teamId,
    place: places[index] ?? index + 1,
    conf: conferenceRecord(teamId, resolved),
    division: null,
    fbs: fbsOf(teamId),
    champion: (places[index] ?? index + 1) === 1,
    titleGame: index < 2,
    tieNote: ranked.notes.get(teamId) ?? null,
    unresolved: ranked.unresolved.has(teamId),
  }));
  const first = rows[0];
  const second = rows[1];
  const champExplanation = first
    ? ranked.explanation.length
      ? `${nameFor(first.teamId)} (${formatWinLoss(first.conf)}) leads. ${ranked.explanation[0]}`
      : `${nameFor(first.teamId)} (${formatWinLoss(first.conf)}) leads on conference ${conference.initialRank === "losses" ? "losses" : "winning percentage"}.`
    : "No teams loaded.";
  const remaining = confGames.filter((game) => !gameWinner(game));
  const completed = confGames.filter((game) => gameWinner(game));
  const tiedAtSecond = second
    ? rows.filter((row) => row.place === second.place && row.unresolved)
    : [];
  const championshipNote =
    first && second
      ? tiedAtSecond.length > 1
        ? `${nameFor(first.teamId)} hosts ${nameFor(second.teamId)} as the top two seeds. ${tiedAtSecond.map((row) => nameFor(row.teamId)).join(", ")} are tied at #${second.place} on ${conference.drawSource.toLowerCase()} (listed alphabetically).`
        : `${nameFor(first.teamId)} hosts ${nameFor(second.teamId)} as the top two seeds.`
      : "Championship field needs two teams.";
  return {
    conference,
    tables: [{ id: conference.id, label: conference.label, rows, champExplanation }],
    championship: {
      homeId: first?.teamId ?? null,
      awayId: second?.teamId ?? null,
      note: championshipNote,
    },
    completedConference: completed,
    remainingConference: remaining,
    unpickedCount: remaining.filter((game) => {
      const pick = picks[game.id];
      return pick !== game.homeTeamId && pick !== game.awayTeamId;
    }).length,
  };
}

export function conferencesPresent(teams: Team[]): ScenarioConference[] {
  const ids = new Set<string>();
  for (const team of teams) {
    const conf = conferenceForTeam(team);
    if (conf) ids.add(conf.id);
  }
  return SCENARIO_CONFERENCES.filter((conf) => ids.has(conf.id));
}
