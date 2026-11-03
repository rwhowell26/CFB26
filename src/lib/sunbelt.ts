import type { Game, Team } from "./types";

export type SunBeltDivisionId = "east" | "west";

export type SunBeltRoster = {
  east: string[];
  west: string[];
};

/** ESPN 2026 Sun Belt football IDs (LA Tech in the West after Texas State left). */
export const SUN_BELT_2026: SunBeltRoster = {
  east: ["256", "2026", "276", "290", "2247", "324", "295"],
  west: ["2348", "309", "6", "2032", "2653", "2572", "2433"],
};

export type WinLoss = {
  wins: number;
  losses: number;
  ties: number;
};

export type RankedSunBeltRow = {
  teamId: string;
  place: number;
  conf: WinLoss;
  division: WinLoss;
  fbs: WinLoss;
  champion: boolean;
  tieNote: string | null;
  unresolved: boolean;
};

export type DivisionTable = {
  id: SunBeltDivisionId;
  label: string;
  rows: RankedSunBeltRow[];
  champExplanation: string;
};

export type ChampionshipProjection = {
  eastId: string | null;
  westId: string | null;
  hostId: string | null;
  hostNote: string;
};

export type SunBeltProjection = {
  east: DivisionTable;
  west: DivisionTable;
  championship: ChampionshipProjection;
  completedConference: Game[];
  remainingConference: Game[];
  unpickedCount: number;
};

export type SunBeltOptions = {
  roster?: SunBeltRoster;
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

type EngineCtx = {
  roster: SunBeltRoster;
  east: Set<string>;
  west: Set<string>;
  games: ResolvedGame[];
  byTeam: Map<string, ResolvedGame[]>;
  cfpRanks: Map<string, number> | null;
  finalWeek: number;
  nameFor: (id: string) => string;
};

type Criterion = {
  id: string;
  label: string;
  score: (teamId: string, group: string[], ctx: EngineCtx, standings: StandingsWalk) => number | null;
};

type StandingsWalk = {
  above: string[];
  belowGroups: string[][];
};

type TieNote = {
  teams: string[];
  text: string;
};

type ResolveResult = {
  order: string[];
  notes: Map<string, string>;
  unresolved: Set<string>;
  tieGroups: Map<string, string>;
  explanation: TieNote[];
};

function emptyWl(): WinLoss {
  return { wins: 0, losses: 0, ties: 0 };
}

export function formatWinLoss(record: WinLoss): string {
  if (record.ties > 0) return `${record.wins}-${record.losses}-${record.ties}`;
  return `${record.wins}-${record.losses}`;
}

export function winningPct(record: WinLoss): number | null {
  const played = record.wins + record.losses + record.ties;
  if (played === 0) return null;
  return (record.wins + record.ties * 0.5) / played;
}

export function formatPct(record: WinLoss): string {
  const pct = winningPct(record);
  if (pct == null) return "—";
  return pct.toFixed(3).replace(/^0/, "");
}

/**
 * Competition ranking (1224): a 3-way tie for second is 2, 2, 2 and the next
 * team is 5. `tiedWithPrevious(i)` is true when index `i` shares a place with
 * the row above it.
 */
export function competitionPlaces(
  count: number,
  tiedWithPrevious: (index: number) => boolean,
): number[] {
  const places: number[] = [];
  for (let i = 0; i < count; i++) {
    places.push(i > 0 && tiedWithPrevious(i) ? places[i - 1]! : i + 1);
  }
  return places;
}

export function markTieGroup(
  group: string[],
  unresolved: Set<string>,
  tieGroups: Map<string, string>,
): string {
  const key = [...group].sort().join("\0");
  for (const id of group) {
    unresolved.add(id);
    tieGroups.set(id, key);
  }
  return key;
}

export function sunBeltDivisionForTeam(
  team: Team,
  roster: SunBeltRoster = SUN_BELT_2026,
): SunBeltDivisionId | null {
  if (team.conference === "Sun Belt - East" || roster.east.includes(team.id)) return "east";
  if (team.conference === "Sun Belt - West" || roster.west.includes(team.id)) return "west";
  return null;
}

export function isSunBeltTeamId(id: string, roster: SunBeltRoster = SUN_BELT_2026): boolean {
  return roster.east.includes(id) || roster.west.includes(id);
}

export function isSunBeltConferenceGame(
  game: Pick<Game, "homeTeamId" | "awayTeamId">,
  roster: SunBeltRoster = SUN_BELT_2026,
): boolean {
  return isSunBeltTeamId(game.homeTeamId, roster) && isSunBeltTeamId(game.awayTeamId, roster);
}

function sameDivision(a: string, b: string, roster: SunBeltRoster): boolean {
  return (
    (roster.east.includes(a) && roster.east.includes(b)) ||
    (roster.west.includes(a) && roster.west.includes(b))
  );
}

function divisionOf(id: string, roster: SunBeltRoster): SunBeltDivisionId | null {
  if (roster.east.includes(id)) return "east";
  if (roster.west.includes(id)) return "west";
  return null;
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

export function conferenceGames(games: Game[], roster: SunBeltRoster = SUN_BELT_2026): Game[] {
  return games
    .filter((game) => isSunBeltConferenceGame(game, roster))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function resolveGames(
  games: Game[],
  roster: SunBeltRoster,
  picks: Record<string, string>,
): ResolvedGame[] {
  const resolved: ResolvedGame[] = [];
  for (const game of conferenceGames(games, roster)) {
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

function recordAgainst(
  teamId: string,
  opponentIds: Set<string> | ((opp: string) => boolean),
  ctx: EngineCtx,
): WinLoss {
  const record = emptyWl();
  const matches =
    typeof opponentIds === "function"
      ? opponentIds
      : (opp: string) => opponentIds.has(opp);
  for (const game of ctx.byTeam.get(teamId) ?? []) {
    const opp = opponentId(game, teamId);
    if (!matches(opp)) continue;
    addResult(record, game, teamId);
  }
  return record;
}

export function conferenceRecord(teamId: string, games: ResolvedGame[]): WinLoss {
  const record = emptyWl();
  for (const game of games) {
    if (!involves(game, teamId)) continue;
    addResult(record, game, teamId);
  }
  return record;
}

function fbsRecord(teamId: string, games: Game[], resolvedConf: ResolvedGame[]): WinLoss {
  const counted = new Set(resolvedConf.map((g) => g.id));
  const record = emptyWl();
  for (const game of games) {
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;
    const isHome = game.homeTeamId === teamId;
    const oppIsFbs = isHome ? game.awayIsFbs : game.homeIsFbs;
    if (!oppIsFbs) continue;
    if (counted.has(game.id)) {
      const resolved = resolvedConf.find((g) => g.id === game.id);
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

function pctOrZero(record: WinLoss): number {
  return winningPct(record) ?? 0;
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

function twoTeamCriteria(): Criterion[] {
  return [
    {
      id: "h2h",
      label: "head-to-head",
      score: (teamId, group, ctx) => {
        const other = group.find((id) => id !== teamId);
        if (!other) return null;
        const record = recordAgainst(teamId, new Set([other]), ctx);
        return winningPct(record);
      },
    },
    {
      id: "division",
      label: "division winning percentage",
      score: (teamId, _group, ctx) => winningPct(divisionRecord(teamId, ctx)),
    },
    {
      id: "standings",
      label: "record vs next-highest in the standings",
      score: (teamId, group, ctx, walk) => standingsWalkScore(teamId, group, ctx, walk),
    },
    {
      id: "common-nondiv",
      label: "common cross-division opponents",
      score: (teamId, group, ctx) => commonNonDivisionScore(teamId, group, ctx),
    },
    {
      id: "cfp-weekend",
      label: "CFP rank plus a final-weekend win",
      score: (teamId, group, ctx) => cfpWeekendScore(teamId, group, ctx),
    },
  ];
}

function divisionRecord(teamId: string, ctx: EngineCtx): WinLoss {
  const div = divisionOf(teamId, ctx.roster);
  const mates = div === "east" ? ctx.east : ctx.west;
  return recordAgainst(teamId, (opp) => mates.has(opp) && opp !== teamId, ctx);
}

function commonNonDivisionScore(teamId: string, group: string[], ctx: EngineCtx): number | null {
  const div = divisionOf(teamId, ctx.roster);
  if (!div) return null;
  const otherDiv = div === "east" ? ctx.west : ctx.east;
  const playedBy = (id: string) => {
    const opps = new Set<string>();
    for (const game of ctx.byTeam.get(id) ?? []) {
      const opp = opponentId(game, id);
      if (otherDiv.has(opp)) opps.add(opp);
    }
    return opps;
  };
  let common = playedBy(group[0]);
  for (const id of group.slice(1)) {
    const played = playedBy(id);
    common = new Set([...common].filter((opp) => played.has(opp)));
  }
  if (common.size === 0) return null;
  return winningPct(recordAgainst(teamId, common, ctx));
}

function standingsWalkScore(
  teamId: string,
  group: string[],
  ctx: EngineCtx,
  walk: StandingsWalk,
): number | null {
  const slots: string[][] = [
    ...walk.above.map((id) => [id]),
    ...walk.belowGroups.filter((slot) => slot.some((id) => !group.includes(id))),
  ];
  for (const slot of slots) {
    const pcts = group.map((id) => winningPct(recordAgainst(id, new Set(slot), ctx)));
    const comparable = pcts.map((pct) => (pct == null ? "skip" : pct.toFixed(6)));
    if (comparable.every((value) => value === "skip")) continue;
    if (new Set(comparable).size === 1) continue;
    const mine = winningPct(recordAgainst(teamId, new Set(slot), ctx));
    return mine;
  }
  return null;
}

function finalWeekendResult(teamId: string, ctx: EngineCtx): "win" | "loss" | "tie" | "none" {
  const games = (ctx.byTeam.get(teamId) ?? []).filter((game) => game.week === ctx.finalWeek);
  if (!games.length) return "none";
  const last = games[games.length - 1];
  if (last.tie) return "tie";
  return last.winnerId === teamId ? "win" : "loss";
}

function cfpWeekendScore(teamId: string, group: string[], ctx: EngineCtx): number | null {
  if (!ctx.cfpRanks || ctx.cfpRanks.size === 0) return null;
  const ranked = group
    .filter((id) => ctx.cfpRanks!.has(id))
    .sort((a, b) => (ctx.cfpRanks!.get(a) ?? 99) - (ctx.cfpRanks!.get(b) ?? 99));
  if (!ranked.length) return null;
  const highest = ranked[0];
  const result = finalWeekendResult(highest, ctx);
  if (result !== "win") return null;
  return teamId === highest ? 1 : 0;
}

function buildTwoCriteria(fbsOf: (id: string) => WinLoss): Criterion[] {
  return [
    ...twoTeamCriteria(),
    {
      id: "fbs",
      label: "overall FBS winning percentage",
      score: (teamId) => winningPct(fbsOf(teamId)),
    },
  ];
}

function buildMultiCriteria(fbsOf: (id: string) => WinLoss): Criterion[] {
  return [
    {
      id: "among-tied",
      label: "record among the tied teams",
      score: (teamId, group, ctx) =>
        winningPct(recordAgainst(teamId, new Set(group.filter((id) => id !== teamId)), ctx)),
    },
    {
      id: "division",
      label: "division winning percentage",
      score: (teamId, _group, ctx) => winningPct(divisionRecord(teamId, ctx)),
    },
    {
      id: "standings",
      label: "record vs next-highest in the standings",
      score: (teamId, group, ctx, walk) => standingsWalkScore(teamId, group, ctx, walk),
    },
    {
      id: "common-nondiv",
      label: "common cross-division opponents",
      score: (teamId, group, ctx) => commonNonDivisionScore(teamId, group, ctx),
    },
    {
      id: "cfp-weekend",
      label: "CFP rank plus a final-weekend win",
      score: (teamId, group, ctx) => cfpWeekendScore(teamId, group, ctx),
    },
    {
      id: "fbs",
      label: "overall FBS winning percentage",
      score: (teamId) => winningPct(fbsOf(teamId)),
    },
  ];
}

function scoreBuckets(
  group: string[],
  criterion: Criterion,
  ctx: EngineCtx,
  walk: StandingsWalk,
): string[][] | null {
  const scores = group.map((id) => criterion.score(id, group, ctx, walk));
  if (scores.every((score) => score == null)) return null;
  const keys = scores.map((score) => (score == null ? "none" : score.toFixed(8)));
  if (new Set(keys).size === 1) return null;
  const buckets = groupByKey(
    [...group].sort((a, b) => {
      const sa = criterion.score(a, group, ctx, walk);
      const sb = criterion.score(b, group, ctx, walk);
      const na = sa == null ? -1 : sa;
      const nb = sb == null ? -1 : sb;
      if (na !== nb) return nb - na;
      return a.localeCompare(b);
    }),
    (id) => {
      const score = criterion.score(id, group, ctx, walk);
      return score == null ? "none" : score.toFixed(8);
    },
  );
  return buckets;
}

function resolveGroup(
  group: string[],
  ctx: EngineCtx,
  walk: StandingsWalk,
  twoCriteria: Criterion[],
  multiCriteria: Criterion[],
  startIndex: number,
  asTwoTeam: boolean,
  notes: Map<string, string>,
  unresolved: Set<string>,
  tieGroups: Map<string, string>,
  explanation: TieNote[],
): string[] {
  if (group.length <= 1) return group;
  const played = group.some((id) => {
    const record = conferenceRecord(id, ctx.games);
    return record.wins + record.losses + record.ties > 0;
  });
  if (!played) {
    return [...group].sort((a, b) => ctx.nameFor(a).localeCompare(ctx.nameFor(b)));
  }
  const two = group.length === 2 || asTwoTeam;
  if (group.length === 2 && !asTwoTeam) {
    return resolveGroup(
      group,
      ctx,
      walk,
      twoCriteria,
      multiCriteria,
      0,
      true,
      notes,
      unresolved,
      tieGroups,
      explanation,
    );
  }
  const criteria = two ? twoCriteria : multiCriteria;
  const names = group.map((id) => ctx.nameFor(id)).join(", ");
  for (let i = startIndex; i < criteria.length; i++) {
    const criterion = criteria[i];
    const buckets = scoreBuckets(group, criterion, ctx, walk);
    if (!buckets) continue;
    explanation.push({
      teams: [...group],
      text: `${two ? "Two-team" : "Multi-team"} tie (${names}) broken on ${criterion.label}.`,
    });
    const ordered: string[] = [];
    for (const [bucketIndex, bucket] of buckets.entries()) {
      if (bucket.length === 1) {
        if (bucketIndex === 0 && group.length > 1) {
          notes.set(
            bucket[0],
            `${criterion.label} over ${group
              .filter((id) => id !== bucket[0])
              .map((id) => ctx.nameFor(id))
              .join(", ")}`,
          );
        }
        ordered.push(bucket[0]);
        continue;
      }
      if (bucket.length === 2) {
        ordered.push(
          ...resolveGroup(
            bucket,
            ctx,
            walk,
            twoCriteria,
            multiCriteria,
            0,
            true,
            notes,
            unresolved,
            tieGroups,
            explanation,
          ),
        );
        continue;
      }
      ordered.push(
        ...resolveGroup(
          bucket,
          ctx,
          walk,
          twoCriteria,
          multiCriteria,
          i + 1,
          false,
          notes,
          unresolved,
          tieGroups,
          explanation,
        ),
      );
    }
    return ordered;
  }
  const fallback = [...group].sort((a, b) => ctx.nameFor(a).localeCompare(ctx.nameFor(b)));
  markTieGroup(fallback, unresolved, tieGroups);
  explanation.push({
    teams: [...group],
    text: `${two ? "Two-team" : "Multi-team"} tie (${names}) reaches a commissioner's coin toss.`,
  });
  for (const id of fallback) {
    notes.set(id, "Unresolved commissioner's coin toss / blended computers.");
  }
  return fallback;
}

function confPctKey(record: WinLoss): string {
  const pct = winningPct(record);
  if (pct == null) return "none";
  return pct.toFixed(8);
}

function rankDivision(
  teamIds: string[],
  ctx: EngineCtx,
  fbsOf: (id: string) => WinLoss,
): ResolveResult {
  const twoCriteria = buildTwoCriteria(fbsOf);
  const multiCriteria = buildMultiCriteria(fbsOf);
  const withPct = [...teamIds].sort((a, b) => {
    const pa = pctOrZero(conferenceRecord(a, ctx.games));
    const pb = pctOrZero(conferenceRecord(b, ctx.games));
    if (pa !== pb) return pb - pa;
    return ctx.nameFor(a).localeCompare(ctx.nameFor(b));
  });
  const confGroups = groupByKey(withPct, (id) => confPctKey(conferenceRecord(id, ctx.games)));
  const notes = new Map<string, string>();
  const unresolved = new Set<string>();
  const tieGroups = new Map<string, string>();
  const explanation: TieNote[] = [];
  const ranked: string[] = [];

  for (let i = 0; i < confGroups.length; i++) {
    const group = confGroups[i];
    const belowGroups = confGroups.slice(i + 1);
    const walk: StandingsWalk = { above: ranked, belowGroups };
    if (group.length === 1) {
      ranked.push(group[0]);
      continue;
    }
    ranked.push(
      ...resolveGroup(
        group,
        ctx,
        walk,
        twoCriteria,
        multiCriteria,
        0,
        group.length === 2,
        notes,
        unresolved,
        tieGroups,
        explanation,
      ),
    );
  }

  return { order: ranked, notes, unresolved, tieGroups, explanation };
}

function makeCtx(
  roster: SunBeltRoster,
  games: ResolvedGame[],
  cfpRanks: Map<string, number> | undefined,
  nameFor: (id: string) => string,
): EngineCtx {
  const byTeam = new Map<string, ResolvedGame[]>();
  for (const game of games) {
    for (const id of [game.homeId, game.awayId]) {
      const list = byTeam.get(id) ?? [];
      list.push(game);
      byTeam.set(id, list);
    }
  }
  const weeks = games.map((game) => game.week);
  return {
    roster,
    east: new Set(roster.east),
    west: new Set(roster.west),
    games,
    byTeam,
    cfpRanks: cfpRanks && cfpRanks.size > 0 ? cfpRanks : null,
    finalWeek: weeks.length ? Math.max(...weeks) : 0,
    nameFor,
  };
}

function tableFor(
  id: SunBeltDivisionId,
  ctx: EngineCtx,
  fbsOf: (id: string) => WinLoss,
): DivisionTable {
  const teamIds = id === "east" ? ctx.roster.east : ctx.roster.west;
  const result = rankDivision(teamIds, ctx, fbsOf);
  const places = competitionPlaces(result.order.length, (index) => {
    const current = result.tieGroups.get(result.order[index]!);
    const previous = result.tieGroups.get(result.order[index - 1]!);
    return current != null && current === previous;
  });
  const rows: RankedSunBeltRow[] = result.order.map((teamId, index) => ({
    teamId,
    place: places[index] ?? index + 1,
    conf: conferenceRecord(teamId, ctx.games),
    division: divisionRecord(teamId, ctx),
    fbs: fbsOf(teamId),
    champion: (places[index] ?? index + 1) === 1,
    tieNote: result.notes.get(teamId) ?? null,
    unresolved: result.unresolved.has(teamId),
  }));
  const champ = rows[0];
  const champName = champ ? ctx.nameFor(champ.teamId) : "TBD";
  const confText = champ ? formatWinLoss(champ.conf) : "";
  const divisionName = id === "east" ? "East" : "West";
  const reasons = result.explanation
    .filter((note) => champ && note.teams.includes(champ.teamId))
    .map((note) => note.text);
  const champExplanation = champ
    ? reasons.length
      ? `${champName} (${confText}) is the ${divisionName} champion. ${reasons.join(" ")}`
      : `${champName} (${confText}) leads the ${divisionName} on conference winning percentage.`
    : `No ${divisionName} teams loaded.`;
  return {
    id,
    label: id === "east" ? "East" : "West",
    rows,
    champExplanation,
  };
}

function hostForChampionship(
  eastId: string | null,
  westId: string | null,
  ctx: EngineCtx,
  fbsOf: (id: string) => WinLoss,
): { hostId: string | null; hostNote: string } {
  if (!eastId || !westId) {
    return { hostId: eastId ?? westId, hostNote: "Awaiting both division champions." };
  }
  const eastPct = winningPct(conferenceRecord(eastId, ctx.games)) ?? 0;
  const westPct = winningPct(conferenceRecord(westId, ctx.games)) ?? 0;
  if (eastPct !== westPct) {
    const hostId = eastPct > westPct ? eastId : westId;
    return {
      hostId,
      hostNote: `${ctx.nameFor(hostId)} hosts on a higher conference winning percentage.`,
    };
  }
  const ep = winningPct(recordAgainst(eastId, new Set([westId]), ctx));
  const wp = winningPct(recordAgainst(westId, new Set([eastId]), ctx));
  if (ep != null && wp != null && ep !== wp) {
    const hostId = ep > wp ? eastId : westId;
    return { hostId, hostNote: `${ctx.nameFor(hostId)} hosts on head-to-head.` };
  }
  const eastFbs = winningPct(fbsOf(eastId)) ?? 0;
  const westFbs = winningPct(fbsOf(westId)) ?? 0;
  if (eastFbs !== westFbs) {
    const hostId = eastFbs > westFbs ? eastId : westId;
    return {
      hostId,
      hostNote: `${ctx.nameFor(hostId)} hosts on overall FBS winning percentage (CFP/computer rankings are not published yet).`,
    };
  }
  return {
    hostId: eastId,
    hostNote:
      "Host tie reaches a commissioner's coin toss after conference percentage, head-to-head, and FBS percentage. East listed until the toss.",
  };
}

export function projectSunBelt(
  teams: Team[],
  games: Game[],
  options: SunBeltOptions = {},
): SunBeltProjection {
  const roster = options.roster ?? SUN_BELT_2026;
  const picks = options.picks ?? {};
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const nameFor = (id: string) => teamsById.get(id)?.shortName ?? id;
  const resolved = resolveGames(games, roster, picks);
  const fbsCache = new Map<string, WinLoss>();
  const fbsOf = (id: string) => {
    const hit = fbsCache.get(id);
    if (hit) return hit;
    const record = fbsRecord(id, games, resolved);
    fbsCache.set(id, record);
    return record;
  };
  const ctx = makeCtx(roster, resolved, options.cfpRanks, nameFor);
  const east = tableFor("east", ctx, fbsOf);
  const west = tableFor("west", ctx, fbsOf);
  const conf = conferenceGames(games, roster);
  const completedConference = conf.filter((game) => gameWinner(game));
  const remainingConference = conf.filter((game) => !gameWinner(game));
  const unpickedCount = remainingConference.filter((game) => {
    const pick = picks[game.id];
    return pick !== game.homeTeamId && pick !== game.awayTeamId;
  }).length;
  const eastId = east.rows[0]?.teamId ?? null;
  const westId = west.rows[0]?.teamId ?? null;
  const host = hostForChampionship(eastId, westId, ctx, fbsOf);
  return {
    east,
    west,
    championship: {
      eastId,
      westId,
      hostId: host.hostId,
      hostNote: host.hostNote,
    },
    completedConference,
    remainingConference,
    unpickedCount,
  };
}

export function weekendLabel(games: Game[]): string {
  if (!games.length) return "";
  const dates = games.map((game) => new Date(game.date));
  const start = new Date(Math.min(...dates.map((d) => d.getTime())));
  const end = new Date(Math.max(...dates.map((d) => d.getTime())));
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameDay = start.getUTCDate() === end.getUTCDate() && sameMonth;
  const month = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "long", timeZone: "America/New_York" });
  const day = (date: Date) =>
    date.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/New_York" });
  if (sameDay) return `${month(start)} ${day(start)}`;
  if (sameMonth) return `${month(start)} ${day(start)}–${day(end)}`;
  return `${month(start)} ${day(start)} – ${month(end)} ${day(end)}`;
}

export function groupGamesByWeek(games: Game[]): { week: number; label: string; games: Game[] }[] {
  const groups = new Map<number, Game[]>();
  for (const game of games) {
    const list = groups.get(game.week) ?? [];
    list.push(game);
    groups.set(game.week, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, weekGames]) => ({
      week,
      label: weekendLabel(weekGames),
      games: weekGames.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    }));
}
