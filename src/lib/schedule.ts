import { regionRanks, teamsIn, tiersInRegion } from "./rankings";
import { rivalsOf } from "./rivals";
import {
  LEAGUE_BYE_WEEK,
  REGIONS,
  RR_START_WEEK,
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

const OUT_OF_TIER_WEEKS = Array.from({ length: LEAGUE_BYE_WEEK - 1 }, (_, i) => i + 1);
const TEAM_IDS = TEAMS.map((team) => team.id);

function leftoverRivals(rivals: RivalMap, seen: Set<string>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const used = new Set<string>();
  for (const team of TEAMS) {
    for (const rivalId of rivalsOf(rivals, team.id)) {
      const key = pairKey(team.id, rivalId);
      if (used.has(key) || seen.has(key)) continue;
      used.add(key);
      pairs.push([team.id, rivalId]);
    }
  }
  return pairs;
}

function plannedCrossovers(assignment: Assignment, seen: Set<string>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const ranks = regionRanks(assignment);
  for (let i = 0; i < REGIONS.length; i += 1) {
    for (let j = i + 1; j < REGIONS.length; j += 1) {
      const regionA = REGIONS[i].id;
      const regionB = REGIONS[j].id;
      for (const [a, b] of matchBalanced(ranks[regionA], ranks[regionB], pairMode(regionA, regionB))) {
        const key = pairKey(a, b);
        if (seen.has(key)) continue;
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

function classifyLeftover(
  a: string,
  b: string,
  assignment: Assignment,
  rivals: RivalMap,
  oocSet: Set<string>,
): { kind: GameKind; label: string } {
  if (rivalsOf(rivals, a).includes(b)) {
    return { kind: "rival", label: "Protected rival" };
  }
  const placeA = assignment[a];
  const placeB = assignment[b];
  if (oocSet.has(pairKey(a, b))) {
    return {
      kind: "inter-region",
      label: `vs ${regionName(placeB.region)} (balanced crossover)`,
    };
  }
  if (placeA.region !== placeB.region) {
    return {
      kind: "inter-region",
      label: `vs ${regionName(placeB.region)} (crossover)`,
    };
  }
  return {
    kind: "cross-tier",
    label: `${regionName(placeA.region)} cross-tier (${tierName(placeA.tier)} vs ${tierName(placeB.tier)})`,
  };
}

function partnerScore(
  a: string,
  b: string,
  assignment: Assignment,
  rivalSet: Set<string>,
  oocSet: Set<string>,
): number {
  const key = pairKey(a, b);
  if (rivalSet.has(key)) return 0;
  if (oocSet.has(key)) return 1;
  const placeA = assignment[a];
  const placeB = assignment[b];
  if (placeA.region === placeB.region && placeA.tier !== placeB.tier) {
    return 2 + Math.abs(placeA.tier - placeB.tier) / 100;
  }
  if (placeA.region !== placeB.region) return 5;
  return 20;
}

function matchLeftoverWeek(
  assignment: Assignment,
  rivals: RivalMap,
  oocSet: Set<string>,
  seen: Set<string>,
): Array<[string, string]> {
  const unmatched = new Set(TEAM_IDS);
  const partner = new Map<string, string>();
  const rivalSet = new Set(leftoverRivals(rivals, seen).map(([a, b]) => pairKey(a, b)));
  const allowed = (a: string, b: string) => a !== b && !seen.has(pairKey(a, b));

  const pair = (a: string, b: string) => {
    if (!unmatched.has(a) || !unmatched.has(b) || !allowed(a, b)) return false;
    unmatched.delete(a);
    unmatched.delete(b);
    partner.set(a, b);
    partner.set(b, a);
    return true;
  };

  for (const [a, b] of leftoverRivals(rivals, seen)) pair(a, b);
  for (const [a, b] of plannedCrossovers(assignment, seen)) {
    if (!oocSet.has(pairKey(a, b))) continue;
    pair(a, b);
  }

  const optionCount = (id: string) =>
    [...unmatched].reduce((sum, other) => sum + (allowed(id, other) ? 1 : 0), 0);

  const greedyFill = () => {
    const rest = [...unmatched].sort((a, b) => optionCount(a) - optionCount(b) || a.localeCompare(b));
    for (const a of rest) {
      if (!unmatched.has(a)) continue;
      let best: string | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      for (const b of unmatched) {
        if (!allowed(a, b)) continue;
        const score = partnerScore(a, b, assignment, rivalSet, oocSet);
        if (score < bestScore) {
          bestScore = score;
          best = b;
        }
      }
      if (best) pair(a, best);
    }
  };
  greedyFill();

  const augment = (start: string): boolean => {
    const visited = new Set<string>();
    const dfs = (u: string): boolean => {
      for (const v of TEAM_IDS) {
        if (v === start || !allowed(u, v) || visited.has(v)) continue;
        visited.add(v);
        const w = partner.get(v);
        if (!w) {
          partner.set(u, v);
          partner.set(v, u);
          unmatched.delete(u);
          unmatched.delete(v);
          return true;
        }
        if (dfs(w)) {
          partner.set(u, v);
          partner.set(v, u);
          unmatched.delete(u);
          return true;
        }
      }
      return false;
    };
    return dfs(start);
  };

  for (const start of [...unmatched]) {
    if (unmatched.has(start)) augment(start);
  }

  if (unmatched.size >= 2) {
    const leftover = [...unmatched];
    for (let i = 0; i < leftover.length; i += 1) {
      for (let j = i + 1; j < leftover.length; j += 1) {
        const a = leftover[i];
        const b = leftover[j];
        if (!unmatched.has(a) || !unmatched.has(b)) continue;
        if (pair(a, b)) continue;
        let swapped = false;
        for (const x of TEAM_IDS) {
          const y = partner.get(x);
          if (!y || x >= y) continue;
          if (allowed(a, x) && allowed(b, y)) {
            partner.set(a, x);
            partner.set(x, a);
            partner.set(b, y);
            partner.set(y, b);
            unmatched.delete(a);
            unmatched.delete(b);
            swapped = true;
            break;
          }
          if (allowed(a, y) && allowed(b, x)) {
            partner.set(a, y);
            partner.set(y, a);
            partner.set(b, x);
            partner.set(x, b);
            unmatched.delete(a);
            unmatched.delete(b);
            swapped = true;
            break;
          }
        }
        if (swapped) break;
      }
    }
  }

  if (unmatched.size) greedyFill();

  const pairs: Array<[string, string]> = [];
  const used = new Set<string>();
  for (const [a, b] of partner) {
    const key = pairKey(a, b);
    if (used.has(key)) continue;
    used.add(key);
    pairs.push([a, b]);
  }
  return pairs;
}

function toCalendarGame(
  a: string,
  b: string,
  week: number,
  kind: GameKind,
  label: string,
): CalendarGame {
  const homeId = homeFor(a, b, week + 17);
  return {
    id: pairKey(a, b),
    week,
    homeId,
    awayId: homeId === a ? b : a,
    kind,
    label,
  };
}

export function buildCalendar(assignment: Assignment, rivals: RivalMap): CalendarGame[] {
  const seen = new Set<string>();
  const placed: CalendarGame[] = [];
  const isRival = (a: string, b: string) => rivalsOf(rivals, a).includes(b);

  for (const region of REGIONS) {
    for (const tier of tiersInRegion(assignment, region.id)) {
      const group = teamsIn(assignment, region.id, tier).map((team) => team.id);
      const rounds = roundRobinRounds(group);
      rounds.forEach((pairs, round) => {
        const week = RR_START_WEEK + round;
        for (const [a, b] of pairs) {
          const rival = isRival(a, b);
          seen.add(pairKey(a, b));
          placed.push(
            toCalendarGame(
              a,
              b,
              week,
              rival ? "rival" : "in-tier",
              rival
                ? `Protected rival · ${region.name} ${tierName(tier)}`
                : `${region.name} ${tierName(tier)}`,
            ),
          );
        }
      });
    }
  }

  const oocSet = new Set(plannedCrossovers(assignment, seen).map(([a, b]) => pairKey(a, b)));

  for (const week of OUT_OF_TIER_WEEKS) {
    const pairs = matchLeftoverWeek(assignment, rivals, oocSet, seen);
    for (const [a, b] of pairs) {
      seen.add(pairKey(a, b));
      const meta = classifyLeftover(a, b, assignment, rivals, oocSet);
      placed.push(toCalendarGame(a, b, week, meta.kind, meta.label));
    }
  }

  return placed.sort((a, b) => a.week - b.week || a.homeId.localeCompare(b.homeId));
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

export function byeWeekOf(games: ScheduledGame[]): number {
  const taken = new Set(games.map((game) => game.week));
  for (let week = 1; week <= SEASON_WEEKS; week += 1) {
    if (!taken.has(week)) return week;
  }
  return LEAGUE_BYE_WEEK;
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
