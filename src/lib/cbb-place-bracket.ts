import type { CbbFieldRole, CbbFieldTeam } from "./cbb-types";

export const REGION_IDS = ["east", "west", "south", "midwest"] as const;
export type RegionId = (typeof REGION_IDS)[number];

export const REGION_META: Record<
  RegionId,
  { label: string; site: string; venue: string }
> = {
  east: { label: "East", site: "New York", venue: "Madison Square Garden" },
  west: { label: "West", site: "Los Angeles", venue: "Crypto.com Arena" },
  south: { label: "South", site: "San Antonio", venue: "Frost Bank Center" },
  midwest: { label: "Midwest", site: "Kansas City", venue: "T-Mobile Center" },
};

/** Visual first-round order (top to bottom) in each region. */
export const FIRST_ROUND_SEEDS = [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11] as const;

const PODS: number[][] = [
  [1, 16, 8, 9],
  [4, 13, 5, 12],
  [2, 15, 7, 10],
  [3, 14, 6, 11],
];

export type PlayInGame = {
  teamIds: [string, string];
  seed: number;
  region: RegionId;
};

export type FirstRoundSlot = {
  seed: number;
  region: RegionId;
  /** Bye team, or empty when the Opening Round winner takes this spot. */
  teamId: string | null;
  playIn: PlayInGame | null;
  role: CbbFieldRole | null;
  trueSeeds: number[];
};

export type RegionBracket = {
  id: RegionId;
  label: string;
  site: string;
  venue: string;
  slots: FirstRoundSlot[];
  trueSeedSum: number;
};

export type PlacedBracket = {
  regions: Record<RegionId, RegionBracket>;
  /** Overall 1 vs 4 and 2 vs 3. */
  finalFour: { left: [RegionId, RegionId]; right: [RegionId, RegionId] };
  openingRound: PlayInGame[];
  playInCount: number;
};

type LineSlot = {
  seed: number;
  playIn: [CbbFieldTeam, CbbFieldTeam] | null;
  occupants: CbbFieldTeam[];
};

function trueSeed(row: CbbFieldTeam): number {
  return row.sCurveIndex + 1;
}

function conferencesOf(slot: LineSlot, teamsById: Map<string, { conference: string }>): string[] {
  return slot.occupants
    .map((row) => teamsById.get(row.teamId)?.conference)
    .filter((name): name is string => Boolean(name));
}

function podOf(seed: number): number {
  return PODS.findIndex((pod) => pod.includes(seed));
}

function halfOf(seed: number): "top" | "bottom" {
  return podOf(seed) <= 1 ? "top" : "bottom";
}

function snakeRegions(seed: number): RegionId[] {
  const forward: RegionId[] = ["east", "west", "south", "midwest"];
  return seed % 2 === 1 ? forward : [...forward].reverse();
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = items.filter((_, index) => index !== i);
    for (const tail of permutations(rest)) out.push([items[i]!, ...tail]);
  }
  return out;
}

/** Last vs second-last, third-last vs fourth-last, … on this seed line. */
function pairPlayIn(playIns: CbbFieldTeam[]): Array<[CbbFieldTeam, CbbFieldTeam]> {
  const worstFirst = [...playIns].sort((left, right) => right.sCurveIndex - left.sCurveIndex);
  const pairs: Array<[CbbFieldTeam, CbbFieldTeam]> = [];
  for (let i = 0; i < worstFirst.length - 1; i += 2) {
    const left = worstFirst[i];
    const right = worstFirst[i + 1];
    if (left && right) pairs.push([left, right]);
  }
  return pairs;
}

function slotsForSeedLine(seed: number, field: CbbFieldTeam[]): LineSlot[] {
  const onLine = field.filter((row) => row.seed === seed).sort((left, right) => left.sCurveIndex - right.sCurveIndex);
  const playIns = onLine.filter((row) => row.playIn);
  const byes = onLine.filter((row) => !row.playIn);
  const slots: LineSlot[] = [];
  for (const pair of pairPlayIn(playIns)) {
    slots.push({ seed, playIn: pair, occupants: pair });
  }
  for (const bye of byes) {
    slots.push({ seed, playIn: null, occupants: [bye] });
  }
  while (slots.length < 4) {
    slots.push({ seed, playIn: null, occupants: [] });
  }
  return slots.slice(0, 4);
}

function teamsOnLines(
  board: Record<RegionId, Record<number, LineSlot | undefined>>,
  region: RegionId,
  seeds: number[],
): CbbFieldTeam[] {
  return seeds.flatMap((seed) => board[region][seed]?.occupants ?? []);
}

function scoreAssignment(
  seed: number,
  slots: LineSlot[],
  order: RegionId[],
  board: Record<RegionId, Record<number, LineSlot | undefined>>,
  teamsById: Map<string, { conference: string }>,
  topFourByConference: Map<string, number>,
  relaxConference: Set<string>,
): number {
  let score = 0;
  for (let i = 0; i < 4; i++) {
    const slot = slots[i];
    const region = order[i];
    if (!slot || !region) continue;
    const conferences = conferencesOf(slot, teamsById);
    if (slot.playIn) {
      const left = teamsById.get(slot.playIn[0].teamId)?.conference;
      const right = teamsById.get(slot.playIn[1].teamId)?.conference;
      if (left && left === right) score += 80;
    }
    for (const conference of conferences) {
      if (seed <= 4) {
        const already = teamsOnLines(board, region, [1, 2, 3, 4]).filter(
          (row) => teamsById.get(row.teamId)?.conference === conference,
        ).length;
        const onTopFour = topFourByConference.get(conference) ?? 0;
        if (already > 0 && onTopFour < 5) score += 60;
      }
      if (relaxConference.has(conference)) continue;
      const sameRegion = teamsOnLines(board, region, FIRST_ROUND_SEEDS as unknown as number[]).filter(
        (row) => teamsById.get(row.teamId)?.conference === conference,
      );
      for (const other of sameRegion) {
        if (podOf(other.seed) === podOf(seed)) score += 25;
        else if (halfOf(other.seed) === halfOf(seed)) score += 12;
        else score += 4;
      }
    }
    if (seed === 2 && region === "east") score += 8;
  }
  if (seed === 4) {
    const sums = REGION_IDS.map((region) => {
      const placed = [1, 2, 3]
        .map((line) => board[region][line]?.occupants[0])
        .filter(Boolean) as CbbFieldTeam[];
      const incoming = slots[order.indexOf(region)]?.occupants[0];
      const rows = incoming ? [...placed, incoming] : placed;
      return rows.reduce((sum, row) => sum + trueSeed(row), 0);
    });
    const spread = Math.max(...sums) - Math.min(...sums);
    if (spread > 6) score += (spread - 6) * 3;
  }
  return score;
}

function toFirstRoundSlot(
  slot: LineSlot,
  region: RegionId,
): FirstRoundSlot {
  const playIn = slot.playIn
    ? {
        teamIds: [slot.playIn[0].teamId, slot.playIn[1].teamId] as [string, string],
        seed: slot.seed,
        region,
      }
    : null;
  const bye = playIn ? null : (slot.occupants[0]?.teamId ?? null);
  return {
    seed: slot.seed,
    region,
    teamId: bye,
    playIn,
    role: slot.occupants[0]?.role ?? null,
    trueSeeds: slot.occupants.map(trueSeed),
  };
}

function emptyBoard(): Record<RegionId, Record<number, LineSlot | undefined>> {
  return {
    east: {},
    west: {},
    south: {},
    midwest: {},
  };
}

/**
 * Place the 76-team field into four 2027 regions using the official
 * seed-list order, Opening Round pairing, S-curve snake, and conference
 * separation. Geography/host sites are not applied.
 */
export function placeBracket(
  field: CbbFieldTeam[],
  teamsById: Map<string, { conference: string }>,
): PlacedBracket {
  const board = emptyBoard();
  const onTopFour = field.filter((row) => row.seed <= 4);
  const topFourByConference = new Map<string, number>();
  for (const row of onTopFour) {
    const conference = teamsById.get(row.teamId)?.conference;
    if (!conference) continue;
    topFourByConference.set(conference, (topFourByConference.get(conference) ?? 0) + 1);
  }
  const inField = field.map((row) => row.teamId);
  const conferenceCounts = new Map<string, number>();
  for (const id of inField) {
    const conference = teamsById.get(id)?.conference;
    if (!conference) continue;
    conferenceCounts.set(conference, (conferenceCounts.get(conference) ?? 0) + 1);
  }
  const lowestAtLarge = field
    .filter((row) => row.role === "at-large")
    .sort((left, right) => right.sCurveIndex - left.sCurveIndex)
    .slice(0, 12);
  const last12AlByConference = new Map<string, number>();
  for (const row of lowestAtLarge) {
    const conference = teamsById.get(row.teamId)?.conference;
    if (!conference) continue;
    last12AlByConference.set(conference, (last12AlByConference.get(conference) ?? 0) + 1);
  }
  const relaxConference = new Set<string>();
  for (const [conference, count] of conferenceCounts) {
    if (count >= 9) relaxConference.add(conference);
  }
  for (const [conference, count] of last12AlByConference) {
    if (count >= 2) relaxConference.add(conference);
  }

  for (let seed = 1; seed <= 16; seed++) {
    const slots = slotsForSeedLine(seed, field);
    const order = snakeRegions(seed);
    let best = slots;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of permutations(slots)) {
      const score = scoreAssignment(
        seed,
        candidate,
        order,
        board,
        teamsById,
        topFourByConference,
        relaxConference,
      );
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
        if (score === 0) break;
      }
    }
    for (let i = 0; i < 4; i++) {
      const region = order[i]!;
      board[region][seed] = best[i];
    }
  }

  const openingRound: PlayInGame[] = [];
  const regions = {} as Record<RegionId, RegionBracket>;
  for (const id of REGION_IDS) {
    const meta = REGION_META[id];
    const slots = FIRST_ROUND_SEEDS.map((seed) => {
      const line = board[id][seed] ?? { seed, playIn: null, occupants: [] };
      const slot = toFirstRoundSlot(line, id);
      if (slot.playIn) openingRound.push(slot.playIn);
      return slot;
    });
    const trueSeedSum = [1, 2, 3, 4].reduce((sum, seed) => {
      const occupant = board[id][seed]?.occupants[0];
      return sum + (occupant ? trueSeed(occupant) : 0);
    }, 0);
    regions[id] = {
      id,
      label: meta.label,
      site: meta.site,
      venue: meta.venue,
      slots,
      trueSeedSum,
    };
  }

  return {
    regions,
    finalFour: { left: ["east", "midwest"], right: ["west", "south"] },
    openingRound,
    playInCount: openingRound.length,
  };
}

export function slotTeams(slot: FirstRoundSlot): string[] {
  if (slot.playIn) return [...slot.playIn.teamIds];
  return slot.teamId ? [slot.teamId] : [];
}
