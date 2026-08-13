import { regionRanks, teamsIn } from "./rankings";
import { getTeam, REGIONS, TEAMS, winPct } from "./teams";
import type {
  Assignment,
  GameKind,
  RegionId,
  ScheduledGame,
  Team,
  TeamSchedule,
  TierId,
} from "./types";

const IN_TIER_GAMES = 6;
const CYCLE_YEARS = 10;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function homeFor(a: string, b: string, year: number): string {
  const [left, right] = a < b ? [a, b] : [b, a];
  return (year + left.length + right.length) % 2 === 0 ? left : right;
}

/** Symmetric in-tier pairings for one year, excluding protected rivals. */
export function inTierPairs(
  ids: string[],
  forbidden: Set<string>,
  year: number,
  degree = IN_TIER_GAMES,
): Array<[string, string]> {
  const size = ids.length;
  if (size < 2) return [];

  const used = new Set<string>();
  const degreeOf: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const edges: Array<[string, string]> = [];

  const tryAdd = (a: string, b: string) => {
    if (a === b) return false;
    const key = pairKey(a, b);
    if (forbidden.has(key) || used.has(key)) return false;
    if (degreeOf[a] >= degree || degreeOf[b] >= degree) return false;
    degreeOf[a] += 1;
    degreeOf[b] += 1;
    used.add(key);
    edges.push([a, b]);
    return true;
  };

  const distances: number[] = [];
  const maxTwoWay = Math.floor((size - 1) / 2);
  for (let step = 0; step < maxTwoWay; step += 1) {
    distances.push(((year + step) % maxTwoWay) + 1);
  }
  if (size % 2 === 0) distances.push(size / 2);

  for (const distance of distances) {
    if (size % 2 === 0 && distance === size / 2) {
      for (let i = 0; i < size / 2; i += 1) {
        tryAdd(ids[i], ids[i + distance]);
      }
      continue;
    }
    const seen = new Set<string>();
    for (let i = 0; i < size; i += 1) {
      const j = (i + distance) % size;
      const key = pairKey(ids[i], ids[j]);
      if (seen.has(key)) continue;
      seen.add(key);
      tryAdd(ids[i], ids[j]);
    }
  }

  let progressed = true;
  while (progressed) {
    progressed = false;
    const needy = ids
      .filter((id) => degreeOf[id] < degree)
      .sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < needy.length; i += 1) {
      for (let j = i + 1; j < needy.length; j += 1) {
        if (tryAdd(needy[i], needy[j])) progressed = true;
      }
    }
  }

  return edges;
}

function matchTwoRegions(a: Team[], b: Team[], rivalPairs: Set<string>): Array<[string, string]> {
  const usedB = new Set<number>();
  const pairs: Array<[string, string]> = [];

  a.forEach((team, index) => {
    const target =
      a.length <= 1 || b.length <= 1
        ? 0
        : Math.round((index * (b.length - 1)) / (a.length - 1));

    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < b.length; i += 1) {
      if (usedB.has(i)) continue;
      const rival = rivalPairs.has(pairKey(team.id, b[i].id));
      const score = Math.abs(i - target) + (rival ? 1000 : 0);
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

function allRivalPairs(): Set<string> {
  const forbidden = new Set<string>();
  for (const team of TEAMS) {
    for (const rivalId of team.rivals) {
      forbidden.add(pairKey(team.id, rivalId));
    }
  }
  return forbidden;
}

export function buildSeasonPairings(
  assignment: Assignment,
  year = 0,
): Map<string, ScheduledGame[]> {
  const games = new Map<string, ScheduledGame[]>();
  const add = (teamId: string, game: ScheduledGame) => {
    const list = games.get(teamId) ?? [];
    list.push(game);
    games.set(teamId, list);
  };

  const rivalPairs = allRivalPairs();

  // Protected rivals
  const seenRivals = new Set<string>();
  for (const team of TEAMS) {
    for (const rivalId of team.rivals) {
      const key = pairKey(team.id, rivalId);
      if (seenRivals.has(key)) continue;
      seenRivals.add(key);
      const homeId = homeFor(team.id, rivalId, year);
      add(team.id, {
        opponentId: rivalId,
        kind: "rival",
        home: homeId === team.id,
        label: "Protected rival",
      });
      add(rivalId, {
        opponentId: team.id,
        kind: "rival",
        home: homeId === rivalId,
        label: "Protected rival",
      });
    }
  }

  // In-tier rotation
  for (const region of REGIONS) {
    for (const tier of [1, 2, 3] as TierId[]) {
      const group = teamsIn(assignment, region.id, tier).map((team) => team.id);
      const pairs = inTierPairs(group, rivalPairs, year);
      for (const [a, b] of pairs) {
        const homeId = homeFor(a, b, year + 17);
        add(a, {
          opponentId: b,
          kind: "in-tier",
          home: homeId === a,
          label: `${region.name} Tier ${tier}`,
        });
        add(b, {
          opponentId: a,
          kind: "in-tier",
          home: homeId === b,
          label: `${region.name} Tier ${tier}`,
        });
      }
    }
  }

  // One game vs each other region, matched by last year's standing
  const ranks = regionRanks(assignment);
  const seenInter = new Set<string>();
  for (let i = 0; i < REGIONS.length; i += 1) {
    for (let j = i + 1; j < REGIONS.length; j += 1) {
      const regionA = REGIONS[i].id;
      const regionB = REGIONS[j].id;
      const pairs = matchTwoRegions(ranks[regionA], ranks[regionB], rivalPairs);
      for (const [a, b] of pairs) {
        const key = pairKey(a, b);
        if (seenInter.has(key) || rivalPairs.has(key)) continue;
        seenInter.add(key);
        const homeId = homeFor(a, b, year + 29);
        const placeA = assignment[a];
        const placeB = assignment[b];
        add(a, {
          opponentId: b,
          kind: "inter-region",
          home: homeId === a,
          label: `vs ${titleRegion(placeB.region)} #${standingIndex(ranks, b) + 1}`,
        });
        add(b, {
          opponentId: a,
          kind: "inter-region",
          home: homeId === b,
          label: `vs ${titleRegion(placeA.region)} #${standingIndex(ranks, a) + 1}`,
        });
      }
    }
  }

  for (const [teamId, list] of games) {
    list.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.opponentId.localeCompare(b.opponentId));
    games.set(teamId, list);
  }

  return games;
}

function standingIndex(ranks: Record<RegionId, Team[]>, teamId: string): number {
  const team = getTeam(teamId);
  for (const region of REGIONS) {
    const idx = ranks[region.id].findIndex((item) => item.id === teamId);
    if (idx >= 0) return idx;
  }
  return team.wins;
}

function titleRegion(region: RegionId): string {
  return REGIONS.find((item) => item.id === region)?.name ?? region;
}

function kindOrder(kind: GameKind): number {
  if (kind === "rival") return 0;
  if (kind === "in-tier") return 1;
  return 2;
}

export function scheduleFor(
  assignment: Assignment,
  teamId: string,
  year = 0,
): TeamSchedule {
  const all = buildSeasonPairings(assignment, year);
  return { teamId, games: all.get(teamId) ?? [] };
}

export function allSchedules(assignment: Assignment, year = 0): Record<string, TeamSchedule> {
  const pairings = buildSeasonPairings(assignment, year);
  return Object.fromEntries(
    TEAMS.map((team) => [team.id, { teamId: team.id, games: pairings.get(team.id) ?? [] }]),
  );
}

/** Times each in-region pair is scheduled across a 10-year rotation. */
export function tenYearFrequencies(
  assignment: Assignment,
  teamId: string,
): Array<{ opponentId: string; times: number; everyYear: boolean }> {
  const place = assignment[teamId];
  const regionTeams = teamsIn(assignment, place.region).filter((team) => team.id !== teamId);
  const counts = new Map<string, number>();
  const rivals = new Set(getTeam(teamId).rivals);

  for (const opponent of regionTeams) {
    counts.set(opponent.id, rivals.has(opponent.id) ? CYCLE_YEARS : 0);
  }

  for (let year = 0; year < CYCLE_YEARS; year += 1) {
    const games = buildSeasonPairings(assignment, year).get(teamId) ?? [];
    for (const game of games) {
      if (!counts.has(game.opponentId)) continue;
      if (rivals.has(game.opponentId)) continue;
      counts.set(game.opponentId, (counts.get(game.opponentId) ?? 0) + 1);
    }
  }

  return regionTeams.map((opponent) => ({
    opponentId: opponent.id,
    times: counts.get(opponent.id) ?? 0,
    everyYear: rivals.has(opponent.id),
  }));
}

export function scheduleStrength(games: ScheduledGame[]): number {
  if (!games.length) return 0;
  const sum = games.reduce((total, game) => total + winPct(getTeam(game.opponentId)), 0);
  return sum / games.length;
}
