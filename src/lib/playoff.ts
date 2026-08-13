import { teamsIn, tiersInRegion } from "./rankings";
import { compareRecords, getTeam, PLAYOFF_TIERS, regionName, REGIONS, tierName } from "./teams";
import type { Assignment, PlayoffGame, PlayoffTeam, Team } from "./types";

const FIELD_SIZE = 24;
const BYES = 8;

function projectedWinner(aId: string | null, bId: string | null): string | null {
  if (!aId) return bId;
  if (!bId) return aId;
  return compareRecords(getTeam(aId), getTeam(bId)) < 0 ? aId : bId;
}

export function playoffTeamsInGroup(group: Team[], tier: number): Team[] {
  if (tier > PLAYOFF_TIERS) return [];
  return group.slice(0, 2);
}

export function buildPlayoffField(assignment: Assignment): PlayoffTeam[] {
  const selected: PlayoffTeam[] = [];

  for (const region of REGIONS) {
    for (const tier of tiersInRegion(assignment, region.id)) {
      if (tier > PLAYOFF_TIERS) continue;
      const group = teamsIn(assignment, region.id, tier);
      const bids = playoffTeamsInGroup(group, tier);
      bids.forEach((team, index) => {
        selected.push({
          teamId: team.id,
          seed: 0,
          bid: index === 0 ? "tier-champion" : "tier-runner-up",
          bidLabel: `${regionName(region.id)} ${tierName(tier)} ${index === 0 ? "champion" : "runner-up"}`,
          bye: false,
        });
      });
    }
  }

  return selected
    .sort((a, b) => compareRecords(getTeam(a.teamId), getTeam(b.teamId)))
    .map((entry, index) => ({
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
      labelA: String(high),
      labelB: String(low),
    });
    firstRoundWinners.push({ seed: high, teamId: winner });
  }

  const second: PlayoffGame[] = [];
  for (let seed = 1; seed <= 8; seed += 1) {
    const byeTeam = bySeed.get(seed);
    const incoming = firstRoundWinners[8 - seed];
    second.push({
      id: `r16-${seed}`,
      round: "second",
      roundLabel: "Round of 16",
      seedA: seed,
      seedB: incoming.seed,
      teamAId: byeTeam?.teamId ?? null,
      teamBId: incoming.teamId,
      projectedWinnerId: projectedWinner(byeTeam?.teamId ?? null, incoming.teamId),
      labelA: `${seed} (bye)`,
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
  const quarters = quarterSeeds.map(([high, low]) => {
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

  const semis = [
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

export function playoffSummary(field: PlayoffTeam[]) {
  return {
    autobids: field.length,
    atLarge: 0,
    byes: field.filter((entry) => entry.bye).length,
    fieldSize: field.length,
  };
}
