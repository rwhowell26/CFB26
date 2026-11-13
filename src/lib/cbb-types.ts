import type { Team } from "./types";

export type CbbTeam = Team & {
  wins: number;
  losses: number;
};

export type CbbPlayedGame = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  winnerId: string | null;
  status: "scheduled" | "in_progress" | "final";
};

export type CbbFieldResult = {
  opponentId: string;
  result: "W" | "L";
  seed: number;
  rank: number;
  playIn: boolean;
};

export type QuadRecord = {
  wins: number;
  losses: number;
};

export type CbbScrubPhase = "at-large" | "recommend" | "auto-bid";

/** Published ranks: 1 is best. Null until a source is wired. */
export type CbbTeamMetrics = {
  teamId: string;
  sor: number | null;
  kpi: number | null;
  wab: number | null;
  kenpom: number | null;
  bpi: number | null;
  torvik: number | null;
  /** Quad records need NET; stay blank until that feed exists. */
  quad1: QuadRecord | null;
  quad2: QuadRecord | null;
  quad3: QuadRecord | null;
  quad4: QuadRecord | null;
};

export type CbbFieldRole = "at-large" | "auto-bid";

export type CbbFieldTeam = {
  teamId: string;
  role: CbbFieldRole;
  sCurveIndex: number;
  seed: number;
  playIn: boolean;
};

export type CbbScrubBand = "field" | "last-four-in" | "first-four-out" | "next-four-out" | "out";

/** Live seed-list spot while scrubbing or on the saved board. */
export type CbbTeamSpot = {
  rank: number;
  seed: number | null;
  playIn: boolean;
  band: CbbScrubBand;
};

export type CbbSnapshot = {
  id: string;
  createdAt: string;
  label: string;
  /** Best-to-worst working pool used to build this projection. */
  sCurve: string[];
  atLargeIds: string[];
  autoBidByConference: Record<string, string>;
  firstFourOut: string[];
  nextFourOut: string[];
  recommendedIds: string[];
};

export type CbbScrubCheckpoint = {
  rankedIds: string[];
  confirmedPairs: string[];
  phase: CbbScrubPhase;
  climbingId: string | null;
  recommendQueue: string[];
  autoBidIds: string[];
};

export type CbbDraft = {
  id: string;
  startedAt: string;
  basedOnId: string | null;
  rankedIds: string[];
  confirmedPairs: string[];
  phase: CbbScrubPhase;
  climbingId: string | null;
  recommendQueue: string[];
  autoBidIds: string[];
  history: CbbScrubCheckpoint[];
};

export type CbbStore = {
  season: number;
  schemaVersion: number;
  snapshots: CbbSnapshot[];
  draft: CbbDraft | null;
  viewingId: string | null;
  eliminatorLockedIds: string[];
  eliminatorEliminatedIds: string[];
  /** Approved In Contention roster. Null until the tab seeds from the current criteria. */
  contentionApprovedIds: string[] | null;
};
