import { playoffTeamsInGroup } from "./playoff";
import { teamsIn, tiersInRegion } from "./rankings";
import {
  compareRecords,
  MAX_MOVEMENT,
  regionName,
  REGIONS,
  tierName,
  TIER_SIZE,
} from "./teams";
import type { Assignment, RegionId, Team } from "./types";

export type MovementReason =
  | "champion"
  | "last-place"
  | "playoff"
  | "relegation-win"
  | "relegation-loss";

export type MovementItem = {
  teamId: string;
  fromTier: number;
  toTier: number;
  reason: MovementReason;
  detail: string;
};

export type RelegationGame = {
  region: RegionId;
  higherId: string;
  lowerId: string;
  higherTier: number;
  lowerTier: number;
  projectedWinnerId: string;
  swaps: boolean;
};

export type RegionMovement = {
  region: RegionId;
  complete: boolean;
  warning?: string;
  promotions: MovementItem[];
  relegations: MovementItem[];
  games: RelegationGame[];
};

function nextUnused(list: Team[], used: Set<string>, fromEnd: boolean): Team | undefined {
  const ordered = fromEnd ? [...list].reverse() : list;
  return ordered.find((team) => !used.has(team.id));
}

export function planRegionMovement(assignment: Assignment, region: RegionId): RegionMovement {
  const tiers = tiersInRegion(assignment, region);
  const promotions: MovementItem[] = [];
  const relegations: MovementItem[] = [];
  const games: RelegationGame[] = [];

  if (!tiers.length) {
    return { region, complete: false, warning: "No teams in this region", promotions, relegations, games };
  }

  const sizes = tiers.map((tier) => teamsIn(assignment, region, tier).length);
  const complete = sizes.every((size) => size === TIER_SIZE);
  if (!complete) {
    return {
      region,
      complete: false,
      warning: `${regionName(region)} tiers must each have ${TIER_SIZE} teams before movement (now ${sizes.join("/")})`,
      promotions,
      relegations,
      games,
    };
  }

  for (let i = 0; i < tiers.length - 1; i += 1) {
    const higherTier = tiers[i];
    const lowerTier = tiers[i + 1];
    const higher = teamsIn(assignment, region, higherTier);
    const lower = teamsIn(assignment, region, lowerTier);
    const usedH = new Set<string>();
    const usedL = new Set<string>();

    const last = higher[higher.length - 1];
    const champ = lower[0];
    relegations.push({
      teamId: last.id,
      fromTier: higherTier,
      toTier: lowerTier,
      reason: "last-place",
      detail: `${tierName(higherTier)} last place always goes down`,
    });
    promotions.push({
      teamId: champ.id,
      fromTier: lowerTier,
      toTier: higherTier,
      reason: "champion",
      detail: `${tierName(lowerTier)} champion always goes up`,
    });
    usedH.add(last.id);
    usedL.add(champ.id);

    for (const team of playoffTeamsInGroup(lower, lowerTier)) {
      if (usedL.has(team.id) || promotions.filter((item) => item.fromTier === lowerTier).length >= MAX_MOVEMENT) {
        continue;
      }
      const drop = nextUnused(higher, usedH, true);
      if (!drop) continue;
      promotions.push({
        teamId: team.id,
        fromTier: lowerTier,
        toTier: higherTier,
        reason: "playoff",
        detail: `Playoff autobid from ${tierName(lowerTier)}`,
      });
      relegations.push({
        teamId: drop.id,
        fromTier: higherTier,
        toTier: lowerTier,
        reason: "playoff",
        detail: `Displaced by a ${tierName(lowerTier)} playoff team`,
      });
      usedL.add(team.id);
      usedH.add(drop.id);
    }

    const alreadyUp = promotions.filter((item) => item.fromTier === lowerTier).length;
    const playInSlots = MAX_MOVEMENT - alreadyUp;
    for (let slot = 0; slot < playInSlots; slot += 1) {
      const hBubble = nextUnused(higher, usedH, true);
      const lBubble = nextUnused(lower, usedL, false);
      if (!hBubble || !lBubble) break;
      usedH.add(hBubble.id);
      usedL.add(lBubble.id);
      const lowerWins = compareRecords(lBubble, hBubble) < 0;
      games.push({
        region,
        higherId: hBubble.id,
        lowerId: lBubble.id,
        higherTier,
        lowerTier,
        projectedWinnerId: lowerWins ? lBubble.id : hBubble.id,
        swaps: lowerWins,
      });
      if (lowerWins) {
        promotions.push({
          teamId: lBubble.id,
          fromTier: lowerTier,
          toTier: higherTier,
          reason: "relegation-win",
          detail: `Won relegation game vs ${hBubble.shortName}`,
        });
        relegations.push({
          teamId: hBubble.id,
          fromTier: higherTier,
          toTier: lowerTier,
          reason: "relegation-loss",
          detail: `Lost relegation game vs ${lBubble.shortName}`,
        });
      }
    }
  }

  return { region, complete: true, promotions, relegations, games };
}

export function planAllMovement(assignment: Assignment): RegionMovement[] {
  return REGIONS.map((region) => planRegionMovement(assignment, region.id));
}

export function applyMovement(assignment: Assignment): Assignment {
  const next = { ...assignment };
  for (const plan of planAllMovement(assignment)) {
    if (!plan.complete) continue;
    for (const item of [...plan.promotions, ...plan.relegations]) {
      const current = next[item.teamId];
      next[item.teamId] = { ...current, tier: item.toTier };
    }
  }
  return next;
}
