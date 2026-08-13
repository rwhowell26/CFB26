export type RegionId = "east" | "south" | "midwest" | "west";
export type TierId = 1 | 2 | 3;

export type Team = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string;
  state: string;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  region: RegionId;
  tier: TierId;
  rivals: string[];
};

export type Placement = {
  region: RegionId;
  tier: TierId;
};

export type Assignment = Record<string, Placement>;

export type GameKind = "rival" | "in-tier" | "inter-region";

export type ScheduledGame = {
  opponentId: string;
  kind: GameKind;
  home: boolean;
  label: string;
};

export type TeamSchedule = {
  teamId: string;
  games: ScheduledGame[];
};

export type PlayoffBidKind = "tier-champion" | "tier1-runner-up" | "at-large";

export type PlayoffTeam = {
  teamId: string;
  seed: number;
  bid: PlayoffBidKind;
  bidLabel: string;
  bye: boolean;
};

export type PlayoffGame = {
  id: string;
  round: "first" | "second" | "quarter" | "semi" | "final";
  roundLabel: string;
  seedA: number;
  seedB: number;
  teamAId: string | null;
  teamBId: string | null;
  projectedWinnerId: string | null;
  labelA: string;
  labelB: string;
};
