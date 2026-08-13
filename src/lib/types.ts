export type RegionId = "east" | "south" | "midwest" | "west";
export type TierId = number;
export type Subdivision = "fbs" | "fcs";

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
  wins5: number;
  losses5: number;
  region: RegionId;
  tier: TierId;
  subdivision: Subdivision;
  rivals: string[];
};

export type Placement = {
  region: RegionId;
  tier: TierId;
};

export type Assignment = Record<string, Placement>;
export type RivalMap = Record<string, string[]>;

export type GameKind = "rival" | "in-tier" | "inter-region" | "cross-tier";

export type ScheduledGame = {
  opponentId: string;
  kind: GameKind;
  home: boolean;
  label: string;
  week: number;
};

export type TeamSchedule = {
  teamId: string;
  games: ScheduledGame[];
};

export type CalendarGame = {
  id: string;
  week: number;
  homeId: string;
  awayId: string;
  kind: GameKind;
  label: string;
};

export type PlayoffBidKind = "tier-champion" | "tier-runner-up" | "tier-third";

export type PlayoffTeam = {
  teamId: string;
  seed: number;
  rankCode: string;
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
