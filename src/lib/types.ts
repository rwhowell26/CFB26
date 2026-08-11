export type Team = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  conference: string;
  logo: string | null;
};

export type GameStatus = "scheduled" | "in_progress" | "final";

export type Game = {
  id: string;
  week: number;
  date: string;
  neutralSite: boolean;
  status: GameStatus;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeIsFbs: boolean;
  awayIsFbs: boolean;
};

export type TeamGameView = {
  gameId: string;
  week: number;
  date: string;
  location: "home" | "away" | "neutral";
  opponentId: string | null;
  opponentName: string;
  opponentLogo: string | null;
  opponentIsFbs: boolean;
  opponentRank: number | null;
  result: "W" | "L" | null;
  teamScore: number | null;
  opponentScore: number | null;
  status: GameStatus;
};

export type SosSummary = {
  playedCount: number;
  playedAvgRank: number | null;
  remainingCount: number;
  remainingAvgRank: number | null;
  fcsPlayed: number;
};

export type WeekSnapshot = {
  week: number;
  label: string;
  /** Ordered team IDs, index 0 = rank 1 */
  rankedIds: string[];
  updatedAt: string;
  locked: boolean;
};

export type RankingStore = {
  season: number;
  activeWeek: number;
  drafts: Record<string, string[]>;
  snapshots: Record<string, WeekSnapshot>;
};

export type PhilosophyWarning = {
  type: "lost_to_higher" | "undefeated_behind_loss" | "winless_not_bottom";
  message: string;
  teamId: string;
  relatedTeamId?: string;
};

export type SeasonWeek = {
  number: number;
  label: string;
  detail: string;
  startDate: string;
  endDate: string;
};
