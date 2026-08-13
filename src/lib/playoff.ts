import { teamsIn } from "./rankings";
import { compareRecords, getTeam, REGIONS, TEAMS } from "./teams";
import type { Assignment, PlayoffGame, PlayoffTeam, RegionId, Team, TierId } from "./types";

const FIELD_SIZE = 24;
const BYES = 8;

function projectedWinner(aId: string | null, bId: string | null): string | null {
  if (!aId) return bId;
  if (!bId) return aId;
  return compareRecords(getTeam(aId), getTeam(bId)) < 0 ? aId : bId;
}

function seedLabel(seed: number, bye: boolean): string {
  return bye ? `${seed} (bye)` : String(seed);
}

export function buildPlayoffField(assignment: Assignment): PlayoffTeam[] {
  const selected = new Map<string, PlayoffTeam>();

  const take = (
    team: Team,
    bid: PlayoffTeam["bid"],
    bidLabel: string,
  ) => {
    if (selected.has(team.id) || selected.size >= FIELD_SIZE) return;
    selected.set(team.id, {
      teamId: team.id,
      seed: 0,
      bid,
      bidLabel,
      bye: false,
    });
  };

  for (const region of REGIONS) {
    for (const tier of [1, 2, 3] as TierId[]) {
      const group = teamsIn(assignment, region.id, tier);
      if (!group.length) continue;
      take(
        group[0],
        "tier-champion",
        `${region.name} Tier ${tier} champion`,
      );
      if (tier === 1 && group[1]) {
        take(
          group[1],
          "tier1-runner-up",
          `${region.name} Tier I runner-up`,
        );
      }
    }
  }

  const remaining = TEAMS.filter((team) => !selected.has(team.id)).sort(compareRecords);
  for (const team of remaining) {
    if (selected.size >= FIELD_SIZE) break;
    const place = assignment[team.id];
    take(team, "at-large", `At-large · ${titleRegion(place.region)} Tier ${place.tier}`);
  }

  const ordered = [...selected.values()].sort((a, b) =>
    compareRecords(getTeam(a.teamId), getTeam(b.teamId)),
  );

  return ordered.map((entry, index) => ({
    ...entry,
    seed: index + 1,
    bye: index < BYES,
  }));
}

export function buildPlayoffBracket(field: PlayoffTeam[]): PlayoffGame[] {
  const bySeed = new Map(field.map((entry) => [entry.seed, entry]));
  const games: PlayoffGame[] = [];

  const firstRoundWinners: Array<{ seed: number; teamId: string | null }> = [];

  for (let high = 9; high <= 16; high += 1) {
    const low = FIELD_SIZE + 1 - high;
    const a = bySeed.get(high);
    const b = bySeed.get(low);
    const winner = projectedWinner(a?.teamId ?? null, b?.teamId ?? null);
    games.push({
      id: `r24-${high}-${low}`,
      round: "first",
      roundLabel: "First round",
      seedA: high,
      seedB: low,
      teamAId: a?.teamId ?? null,
      teamBId: b?.teamId ?? null,
      projectedWinnerId: winner,
      labelA: seedLabel(high, false),
      labelB: seedLabel(low, false),
    });
    firstRoundWinners.push({ seed: high, teamId: winner });
  }

  const second: PlayoffGame[] = [];
  for (let seed = 1; seed <= 8; seed += 1) {
    const byeTeam = bySeed.get(seed);
    const incoming = firstRoundWinners[8 - seed];
    const winner = projectedWinner(byeTeam?.teamId ?? null, incoming.teamId);
    second.push({
      id: `r16-${seed}`,
      round: "second",
      roundLabel: "Round of 16",
      seedA: seed,
      seedB: incoming.seed,
      teamAId: byeTeam?.teamId ?? null,
      teamBId: incoming.teamId,
      projectedWinnerId: winner,
      labelA: seedLabel(seed, true),
      labelB: `W ${incoming.seed}/${FIELD_SIZE + 1 - incoming.seed}`,
    });
  }
  games.push(...second);

  const quarterSeeds: Array<[number, number]> = [
    [1, 8],
    [4, 5],
    [2, 7],
    [3, 6],
  ];
  const quarters: PlayoffGame[] = quarterSeeds.map(([high, low]) => {
    const a = second.find((game) => game.seedA === high);
    const b = second.find((game) => game.seedA === low);
    return {
      id: `q-${high}-${low}`,
      round: "quarter" as const,
      roundLabel: "Quarterfinals",
      seedA: high,
      seedB: low,
      teamAId: a?.projectedWinnerId ?? null,
      teamBId: b?.projectedWinnerId ?? null,
      projectedWinnerId: projectedWinner(a?.projectedWinnerId ?? null, b?.projectedWinnerId ?? null),
      labelA: `W of ${high}`,
      labelB: `W of ${low}`,
    };
  });
  games.push(...quarters);

  const semis: PlayoffGame[] = [
    [quarters[0], quarters[1], 1, 4],
    [quarters[2], quarters[3], 2, 3],
  ].map(([a, b, seedA, seedB], index) => ({
    id: `s-${index}`,
    round: "semi" as const,
    roundLabel: "Semifinals",
    seedA: seedA as number,
    seedB: seedB as number,
    teamAId: (a as PlayoffGame).projectedWinnerId,
    teamBId: (b as PlayoffGame).projectedWinnerId,
    projectedWinnerId: projectedWinner(
      (a as PlayoffGame).projectedWinnerId,
      (b as PlayoffGame).projectedWinnerId,
    ),
    labelA: "Winner",
    labelB: "Winner",
  }));
  games.push(...semis);

  games.push({
    id: "final",
    round: "final",
    roundLabel: "National Championship",
    seedA: semis[0].seedA,
    seedB: semis[1].seedA,
    teamAId: semis[0].projectedWinnerId,
    teamBId: semis[1].projectedWinnerId,
    projectedWinnerId: projectedWinner(semis[0].projectedWinnerId, semis[1].projectedWinnerId),
    labelA: "Finalist",
    labelB: "Finalist",
  });

  return games;
}

function titleRegion(region: RegionId): string {
  return REGIONS.find((item) => item.id === region)?.name ?? region;
}

export function playoffSummary(field: PlayoffTeam[]) {
  const autobids = field.filter((entry) => entry.bid !== "at-large").length;
  const byes = field.filter((entry) => entry.bye).length;
  return { autobids, atLarge: field.length - autobids, byes, fieldSize: field.length };
}
