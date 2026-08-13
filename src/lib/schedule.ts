import { regionRanks, teamsIn, tiersInRegion } from "./rankings";
import { rivalsOf } from "./rivals";
import {
  MAX_GAMES,
  REGIONS,
  SEASON_WEEKS,
  TEAMS,
  getTeam,
  regionName,
  tierName,
  winPct,
} from "./teams";
import type {
  Assignment,
  CalendarGame,
  GameKind,
  RegionId,
  RivalMap,
  ScheduledGame,
  Team,
  TeamSchedule,
} from "./types";

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function homeFor(a: string, b: string, salt: number): string {
  const [left, right] = a < b ? [a, b] : [b, a];
  return (salt + left.length + right.length) % 2 === 0 ? left : right;
}

export function roundRobinRounds(ids: string[]): Array<Array<[string, string]>> {
  const teams = [...ids];
  if (teams.length < 2) return [];
  if (teams.length % 2 === 1) teams.push("__BYE__");
  const n = teams.length;
  const half = n / 2;
  const rotation = [...teams];
  const rounds: Array<Array<[string, string]>> = [];
  for (let round = 0; round < n - 1; round += 1) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < half; i += 1) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a === "__BYE__" || b === "__BYE__") continue;
      pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    const last = rest.pop();
    if (last) rest.unshift(last);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }
  return rounds;
}

type RawGame = {
  a: string;
  b: string;
  kind: GameKind;
  label: string;
  suggestedWeek?: number;
};

function matchBalanced(a: Team[], b: Team[], mode: 0 | 1 | 2): Array<[string, string]> {
  if (!a.length || !b.length) return [];
  const usedB = new Set<number>();
  const pairs: Array<[string, string]> = [];
  a.forEach((team, index) => {
    const scaled =
      a.length <= 1 ? 0 : Math.round((index * (b.length - 1)) / (a.length - 1));
    const target =
      mode === 0
        ? b.length - 1 - scaled
        : mode === 1
          ? scaled
          : (scaled + Math.floor(b.length / 2)) % b.length;
    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < b.length; i += 1) {
      if (usedB.has(i)) continue;
      const score = Math.abs(i - target);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) {
      usedB.add(best);
      pairs.push([team.id, b[best].id]);
    }
  });
  return pairs;
}

const PAIR_MODE: Record<string, 0 | 1 | 2> = {
  "east-south": 0,
  "east-midwest": 1,
  "east-west": 2,
  "south-midwest": 2,
  "south-west": 1,
  "midwest-west": 0,
};

function pairMode(a: RegionId, b: RegionId): 0 | 1 | 2 {
  const key = [a, b].sort().join("-");
  return PAIR_MODE[key] ?? 0;
}

export function buildRawGames(assignment: Assignment, rivals: RivalMap): RawGame[] {
  const games: RawGame[] = [];
  const seen = new Set<string>();
  const degree: Record<string, number> = Object.fromEntries(TEAMS.map((team) => [team.id, 0]));

  const add = (a: string, b: string, kind: GameKind, label: string, suggestedWeek?: number) => {
    if (a === b) return false;
    const key = pairKey(a, b);
    if (seen.has(key)) return false;
    if ((degree[a] ?? 0) >= MAX_GAMES || (degree[b] ?? 0) >= MAX_GAMES) return false;
    seen.add(key);
    degree[a] = (degree[a] ?? 0) + 1;
    degree[b] = (degree[b] ?? 0) + 1;
    games.push({ a, b, kind, label, suggestedWeek });
    return true;
  };

  const isRival = (a: string, b: string) => rivalsOf(rivals, a).includes(b);

  for (const region of REGIONS) {
    for (const tier of tiersInRegion(assignment, region.id)) {
      const group = teamsIn(assignment, region.id, tier).map((team) => team.id);
      const rounds = roundRobinRounds(group);
      rounds.forEach((pairs, round) => {
        for (const [a, b] of pairs) {
          const rival = isRival(a, b);
          add(
            a,
            b,
            rival ? "rival" : "in-tier",
            rival
              ? `Protected rival · ${region.name} ${tierName(tier)}`
              : `${region.name} ${tierName(tier)}`,
            round + 1,
          );
        }
      });
    }
  }

  const seenRivals = new Set<string>();
  for (const team of TEAMS) {
    for (const rivalId of rivalsOf(rivals, team.id)) {
      const key = pairKey(team.id, rivalId);
      if (seenRivals.has(key)) continue;
      seenRivals.add(key);
      add(team.id, rivalId, "rival", "Protected rival");
    }
  }

  const ranks = regionRanks(assignment);
  for (let i = 0; i < REGIONS.length; i += 1) {
    for (let j = i + 1; j < REGIONS.length; j += 1) {
      const regionA = REGIONS[i].id;
      const regionB = REGIONS[j].id;
      const pairs = matchBalanced(ranks[regionA], ranks[regionB], pairMode(regionA, regionB));
      for (const [a, b] of pairs) {
        if (isRival(a, b)) continue;
        add(
          a,
          b,
          "inter-region",
          `vs ${regionName(assignment[b].region)} (balanced crossover)`,
        );
      }
    }
  }

  return games;
}

function assignWeeks(games: RawGame[]): CalendarGame[] {
  const busy = new Map<string, Set<number>>();
  const mark = (teamId: string, week: number) => {
    const set = busy.get(teamId) ?? new Set<number>();
    set.add(week);
    busy.set(teamId, set);
  };
  const free = (teamId: string, week: number) => !(busy.get(teamId)?.has(week) ?? false);

  const placed: CalendarGame[] = [];
  const leftover: RawGame[] = [];

  for (const game of games) {
    const week = game.suggestedWeek;
    if (week && free(game.a, week) && free(game.b, week)) {
      const homeId = homeFor(game.a, game.b, week);
      placed.push({
        id: pairKey(game.a, game.b),
        week,
        homeId,
        awayId: homeId === game.a ? game.b : game.a,
        kind: game.kind,
        label: game.label,
      });
      mark(game.a, week);
      mark(game.b, week);
    } else {
      leftover.push(game);
    }
  }

  const weekOrder = [
    ...Array.from({ length: 5 }, (_, i) => i + 8),
    ...Array.from({ length: 7 }, (_, i) => i + 1),
  ].filter((week) => week <= SEASON_WEEKS);

  for (const game of leftover) {
    const week = weekOrder.find((slot) => free(game.a, slot) && free(game.b, slot));
    if (!week) continue;
    const homeId = homeFor(game.a, game.b, week + 40);
    placed.push({
      id: pairKey(game.a, game.b),
      week,
      homeId,
      awayId: homeId === game.a ? game.b : game.a,
      kind: game.kind,
      label: game.label,
    });
    mark(game.a, week);
    mark(game.b, week);
  }

  return placed.sort((a, b) => a.week - b.week || a.homeId.localeCompare(b.homeId));
}

export function buildCalendar(assignment: Assignment, rivals: RivalMap): CalendarGame[] {
  return assignWeeks(buildRawGames(assignment, rivals));
}

export function allSchedules(
  assignment: Assignment,
  rivals: RivalMap,
): Record<string, TeamSchedule> {
  const calendar = buildCalendar(assignment, rivals);
  const schedules: Record<string, TeamSchedule> = Object.fromEntries(
    TEAMS.map((team) => [team.id, { teamId: team.id, games: [] as ScheduledGame[] }]),
  );
  for (const game of calendar) {
    schedules[game.homeId].games.push({
      opponentId: game.awayId,
      kind: game.kind,
      home: true,
      label: game.label,
      week: game.week,
    });
    schedules[game.awayId].games.push({
      opponentId: game.homeId,
      kind: game.kind,
      home: false,
      label: game.label,
      week: game.week,
    });
  }
  for (const schedule of Object.values(schedules)) {
    schedule.games.sort((a, b) => a.week - b.week || a.opponentId.localeCompare(b.opponentId));
  }
  return schedules;
}

export function scheduleFor(
  assignment: Assignment,
  rivals: RivalMap,
  teamId: string,
): TeamSchedule {
  return allSchedules(assignment, rivals)[teamId];
}

export function tenYearFrequencies(
  assignment: Assignment,
  rivals: RivalMap,
  teamId: string,
): Array<{ opponentId: string; times: number; everyYear: boolean }> {
  const place = assignment[teamId];
  const regionTeams = teamsIn(assignment, place.region).filter((team) => team.id !== teamId);
  const rivalSet = new Set(rivalsOf(rivals, teamId));
  const scheduled = new Set(
    (allSchedules(assignment, rivals)[teamId]?.games ?? []).map((game) => game.opponentId),
  );
  return regionTeams.map((opponent) => {
    const sameTier = assignment[opponent.id]?.tier === place.tier;
    const everyYear = rivalSet.has(opponent.id) || sameTier;
    return {
      opponentId: opponent.id,
      times: everyYear || scheduled.has(opponent.id) ? 10 : 0,
      everyYear,
    };
  });
}

export function scheduleStrength(games: ScheduledGame[]): number {
  if (!games.length) return 0;
  const sum = games.reduce((total, game) => total + winPct(getTeam(game.opponentId)), 0);
  return sum / games.length;
}

export function gamesInWeek(
  assignment: Assignment,
  rivals: RivalMap,
  week: number,
  region?: RegionId,
): CalendarGame[] {
  return buildCalendar(assignment, rivals).filter((game) => {
    if (game.week !== week) return false;
    if (!region) return true;
    return assignment[game.homeId]?.region === region || assignment[game.awayId]?.region === region;
  });
}
