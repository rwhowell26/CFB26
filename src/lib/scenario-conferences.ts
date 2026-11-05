import type { Team } from "./types";

function espnConferenceName(name: string): string {
  if (name.startsWith("Sun Belt")) return "Sun Belt Conference";
  return name;
}

export type ScenarioConferenceId =
  | "acc"
  | "big10"
  | "big12"
  | "sec"
  | "aac"
  | "cusa"
  | "mac"
  | "mw"
  | "pac12"
  | "sunbelt";

export type RoundRobinMode =
  | "unequal"
  | "equal"
  | "equal-or-sweep-win"
  | "equal-or-sweep-win-or-loss";

export type TiebreakKind =
  | "round-robin"
  | "division-pct"
  | "standings-walk"
  | "common-opponents"
  | "conf-record-equal"
  | "opponent-win-pct"
  | "total-wins"
  | "overall-pct"
  | "cfp-final-weekend"
  | "cfp-rank"
  | "draw";

export type TiebreakStep = {
  kind: TiebreakKind;
  label: string;
  roundRobin?: RoundRobinMode;
  oneGameEach?: boolean;
  topTeamOnly?: boolean;
  immunity?: boolean;
};

export type ScenarioConference = {
  id: ScenarioConferenceId;
  label: string;
  shortLabel: string;
  espnName: string;
  /** Official policy URL copied from mred's schedule XML. */
  sourceUrl: string | null;
  initialRank: "percentage" | "losses" | "percentage-advantage" | "record-advantage";
  divisions: { id: string; label: string }[] | null;
  championship: "division-winners" | "top-two";
  /** Multi-team procedure, and the default when `twoTeamSteps` is omitted. */
  steps: TiebreakStep[];
  /** Two-team procedure when it differs from the multi-team list. */
  twoTeamSteps?: TiebreakStep[];
  restartAfterSplit: boolean;
  returnToTwoTeam: boolean;
  twoTeamH2hFirst: boolean;
  onlySplitOnePerStep: boolean;
  drawSource: string;
};

export const SCENARIO_CONFERENCES: ScenarioConference[] = [
  {
    id: "acc",
    label: "ACC",
    shortLabel: "ACC",
    espnName: "Atlantic Coast Conference",
    sourceUrl: "https://theacc.com/documents/2026/7/15//ACC_Football_Tiebreaker_Policy_Jully_2026.pdf",
    // 8-game and 9-game teams with the same wins or losses (5-4 and 4-4) share a CCG tie.
    initialRank: "percentage-advantage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: false,
    onlySplitOnePerStep: false,
    drawSource: "SportSource Rating Score",
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal-or-sweep-win-or-loss",
      },
      { kind: "draw", label: "SportSource rating" },
    ],
  },
  {
    id: "big10",
    label: "Big Ten",
    shortLabel: "Big 10",
    espnName: "Big Ten Conference",
    sourceUrl: "https://bigten.org/fb/article/blt6104802d94ebe1ab/",
    initialRank: "percentage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: true,
    onlySplitOnePerStep: true,
    drawSource: "SportSource Rating Score",
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal-or-sweep-win",
      },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      {
        kind: "standings-walk",
        label: "record vs next highest-placed common opponent",
      },
      {
        kind: "opponent-win-pct",
        label: "combined conference winning percentage of conference opponents",
      },
      { kind: "draw", label: "SportSource rating" },
    ],
  },
  {
    id: "big12",
    label: "Big 12",
    shortLabel: "Big 12",
    espnName: "Big 12 Conference",
    sourceUrl: "https://big12sports.com/documents/2025/11/4/Big_12_Football_2024_Tiebreaker_Policy.pdf",
    initialRank: "percentage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: true,
    onlySplitOnePerStep: true,
    drawSource: "SportSource Rating Score",
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal-or-sweep-win",
      },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      {
        kind: "standings-walk",
        label: "record vs next highest-placed common opponent",
      },
      {
        kind: "opponent-win-pct",
        label: "combined conference winning percentage of conference opponents",
      },
      { kind: "total-wins", label: "eligible wins in a 12-game season" },
      { kind: "draw", label: "SportSource rating" },
    ],
  },
  {
    id: "sec",
    label: "SEC",
    shortLabel: "SEC",
    espnName: "Southeastern Conference",
    sourceUrl: "https://www.secsports.com/fbtiebreaker",
    initialRank: "percentage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: true,
    onlySplitOnePerStep: true,
    drawSource: "Capped Relative Scoring Margin",
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal-or-sweep-win-or-loss",
      },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      {
        kind: "standings-walk",
        label: "record vs next highest-placed common opponent",
      },
      {
        kind: "opponent-win-pct",
        label: "cumulative conference winning percentage of conference opponents",
      },
      { kind: "draw", label: "capped relative scoring margin" },
    ],
  },
  {
    id: "aac",
    label: "American",
    shortLabel: "AAC",
    espnName: "American Conference",
    sourceUrl: "https://theamerican.org/documents/2024/10/21/2024_FB_Tiebreakers.pdf",
    initialRank: "percentage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: false,
    onlySplitOnePerStep: false,
    drawSource: "Blended Computer Rankings",
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal-or-sweep-win",
      },
      { kind: "cfp-final-weekend", label: "CFP ranking without a final-weekend loss" },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      { kind: "overall-pct", label: "overall winning percentage" },
      { kind: "draw", label: "blended computer rankings" },
    ],
  },
  {
    id: "cusa",
    label: "Conference USA",
    shortLabel: "CUSA",
    espnName: "Conference USA",
    sourceUrl:
      "https://conferenceusa.com/documents/2024/9/19/CUSA_FB_Championship_Game_Tiebreaker_Policy.pdf",
    initialRank: "record-advantage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: true,
    onlySplitOnePerStep: true,
    drawSource: "Blended Computer Rankings",
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal-or-sweep-win-or-loss",
      },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      {
        kind: "standings-walk",
        label: "record vs next highest-placed common opponent",
      },
      {
        kind: "opponent-win-pct",
        label: "cumulative conference winning percentage of conference opponents",
      },
      { kind: "draw", label: "blended computer rankings" },
    ],
  },
  {
    id: "mac",
    label: "MAC",
    shortLabel: "MAC",
    espnName: "Mid-American Conference",
    sourceUrl: "https://getsomemaction.com/documents/2024/9/18//2024_MAC_FB_Tiebreaker_Policy.pdf",
    initialRank: "percentage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: true,
    onlySplitOnePerStep: true,
    drawSource: "SportSource Rating Score",
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal-or-sweep-win",
      },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      {
        kind: "standings-walk",
        label: "record vs next highest-placed common opponent",
      },
      {
        kind: "opponent-win-pct",
        label: "combined conference winning percentage of conference opponents",
      },
      { kind: "draw", label: "SportSource rating" },
    ],
  },
  {
    id: "mw",
    label: "Mountain West",
    shortLabel: "MW",
    espnName: "Mountain West Conference",
    sourceUrl:
      "https://storage.googleapis.com/themw-com/2025/08/6333f7fd-2025-mw-football-championship-tiebreakers-final.pdf",
    initialRank: "percentage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: false,
    onlySplitOnePerStep: false,
    drawSource: "Blended Computer Rankings",
    steps: [
      {
        kind: "cfp-rank",
        label: "highest CFP ranking (immunity if that team did not lose the final weekend)",
        immunity: true,
      },
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal-or-sweep-win-or-loss",
      },
      { kind: "cfp-final-weekend", label: "CFP ranking without a final-weekend loss" },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      {
        kind: "standings-walk",
        label: "record vs next highest-placed common opponent",
      },
      { kind: "overall-pct", label: "overall winning percentage" },
      { kind: "draw", label: "blended computer rankings" },
    ],
  },
  {
    id: "pac12",
    label: "Pac-12",
    shortLabel: "P12",
    espnName: "Pac-12 Conference",
    sourceUrl:
      "https://pac-12.com/news/2026/9/3/pac-12-announces-commercial-and-operational-updates-ahead-of-its-2026-football-season-kickoff.aspx",
    initialRank: "percentage",
    divisions: null,
    championship: "top-two",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: true,
    onlySplitOnePerStep: true,
    drawSource: "SportSource Rating Score",
    twoTeamSteps: [
      {
        kind: "round-robin",
        label: "head-to-head",
        roundRobin: "equal",
      },
      {
        kind: "standings-walk",
        label: "record vs next highest-placed common opponent",
      },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      { kind: "cfp-rank", label: "CFP ranking before week 13" },
      { kind: "draw", label: "SportSource rating" },
    ],
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "equal",
      },
      {
        kind: "common-opponents",
        label: "win percentage against all common conference opponents",
      },
      {
        kind: "standings-walk",
        label: "record vs next highest-placed common opponent",
      },
      {
        kind: "opponent-win-pct",
        label: "combined conference winning percentage of conference opponents",
      },
      { kind: "draw", label: "SportSource rating" },
    ],
  },
  {
    id: "sunbelt",
    label: "Sun Belt",
    shortLabel: "SBC",
    espnName: "Sun Belt Conference",
    sourceUrl: "https://sunbeltsports.org/sports/2018/8/30/FB_Tie-Breakers.aspx",
    initialRank: "percentage",
    divisions: [
      { id: "east", label: "East" },
      { id: "west", label: "West" },
    ],
    championship: "division-winners",
    restartAfterSplit: true,
    returnToTwoTeam: true,
    twoTeamH2hFirst: false,
    onlySplitOnePerStep: false,
    drawSource: "Blended Computer Rankings",
    steps: [
      {
        kind: "round-robin",
        label: "head-to-head / record among the tied teams",
        roundRobin: "unequal",
      },
      { kind: "division-pct", label: "division winning percentage" },
      {
        kind: "standings-walk",
        label: "record vs next-highest in the division standings",
        oneGameEach: true,
      },
      { kind: "conf-record-equal", label: "common cross-division conference opponents" },
      {
        kind: "cfp-final-weekend",
        label: "CFP ranking plus a final-weekend win",
        topTeamOnly: true,
      },
      { kind: "draw", label: "commissioner's coin toss / blended computers" },
    ],
  },
];

export function conferenceForTeam(team: Team): ScenarioConference | null {
  const name = espnConferenceName(team.conference);
  return SCENARIO_CONFERENCES.find((conf) => conf.espnName === name) ?? null;
}

export function teamsInConference(teams: Team[], conference: ScenarioConference): Team[] {
  return teams.filter((team) => conferenceForTeam(team)?.id === conference.id);
}

export function defaultScenarioConference(
  conferences: ScenarioConference[],
): ScenarioConferenceId {
  return conferences.some((conf) => conf.id === "sunbelt") ? "sunbelt" : conferences[0]!.id;
}
