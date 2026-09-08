import type { Sport } from "./types";

export type RoundDef = {
  key: string;
  label: string;
  /** Higher is better. Conference champs sit below first-round teams. */
  tier: number;
};

export const FOOTBALL_ROUNDS: Record<string, RoundDef> = {
  champion: { key: "champion", label: "National champion", tier: 80 },
  runnerUp: { key: "runnerUp", label: "National runner-up", tier: 70 },
  semifinal: { key: "semifinal", label: "Semifinals", tier: 60 },
  quarterfinal: { key: "quarterfinal", label: "Quarterfinals", tier: 50 },
  secondRound: { key: "secondRound", label: "Second round", tier: 40 },
  firstRound: { key: "firstRound", label: "First round", tier: 30 },
  confChamp: { key: "confChamp", label: "FBS conference champion", tier: 20 },
  none: { key: "none", label: "No postseason", tier: 0 },
};

export const BASKETBALL_ROUNDS: Record<string, RoundDef> = {
  champion: { key: "champion", label: "National champion", tier: 80 },
  runnerUp: { key: "runnerUp", label: "National runner-up", tier: 70 },
  finalFour: { key: "finalFour", label: "Final Four", tier: 60 },
  eliteEight: { key: "eliteEight", label: "Elite Eight", tier: 50 },
  sweetSixteen: { key: "sweetSixteen", label: "Sweet 16", tier: 40 },
  round32: { key: "round32", label: "Round of 32", tier: 32 },
  round64: { key: "round64", label: "Round of 64", tier: 24 },
  firstFour: { key: "firstFour", label: "First Four", tier: 16 },
  none: { key: "none", label: "No postseason", tier: 0 },
};

export const BASEBALL_ROUNDS: Record<string, RoundDef> = {
  champion: { key: "champion", label: "National champion", tier: 80 },
  runnerUp: { key: "runnerUp", label: "National runner-up", tier: 70 },
  cws: { key: "cws", label: "College World Series", tier: 55 },
  superRegional: { key: "superRegional", label: "Super Regional", tier: 40 },
  regional: { key: "regional", label: "Regional", tier: 24 },
  none: { key: "none", label: "No postseason", tier: 0 },
};

export function roundsFor(sport: Sport): Record<string, RoundDef> {
  if (sport === "football") return FOOTBALL_ROUNDS;
  if (sport === "basketball") return BASKETBALL_ROUNDS;
  return BASEBALL_ROUNDS;
}

export function classifyFootballHeadline(headline: string): {
  kind: "playoff" | "confChamp" | "ignore";
  roundKey?: string;
} {
  const h = headline.trim();
  if (/College Football Playoff/i.test(h)) {
    if (/National Championship/i.test(h)) return { kind: "playoff", roundKey: "championshipGame" };
    if (/Semifinal/i.test(h)) return { kind: "playoff", roundKey: "semifinal" };
    if (/Quarterfinal/i.test(h)) return { kind: "playoff", roundKey: "quarterfinal" };
    if (/First Round/i.test(h)) return { kind: "playoff", roundKey: "firstRound" };
    return { kind: "playoff", roundKey: "firstRound" };
  }
  if (/FCS Championship/i.test(h)) {
    if (/First Round/i.test(h)) return { kind: "playoff", roundKey: "firstRound" };
    if (/Second Round/i.test(h)) return { kind: "playoff", roundKey: "secondRound" };
    if (/Quarterfinal/i.test(h)) return { kind: "playoff", roundKey: "quarterfinal" };
    if (/Semifinal/i.test(h)) return { kind: "playoff", roundKey: "semifinal" };
    return { kind: "playoff", roundKey: "championshipGame" };
  }
  if (/Bowl/i.test(h) || /Celebration/i.test(h)) return { kind: "ignore" };
  if (/Championship/i.test(h)) return { kind: "confChamp" };
  return { kind: "ignore" };
}

export function classifyBasketballHeadline(headline: string): string | null {
  if (!/NCAA Men's Basketball Championship/i.test(headline)) return null;
  if (/National Championship/i.test(headline)) return "championshipGame";
  if (/Final Four/i.test(headline)) return "finalFour";
  if (/Elite 8|Elite Eight|Regional Final/i.test(headline)) return "eliteEight";
  if (/Sweet 16|Sweet Sixteen/i.test(headline)) return "sweetSixteen";
  if (/2nd Round|Second Round/i.test(headline)) return "round32";
  if (/First Four|Play-In/i.test(headline)) return "firstFour";
  if (/1st Round|First Round/i.test(headline)) return "round64";
  return "round64";
}

export function classifyBaseballHeadline(headline: string): string | null {
  if (/Championship Final/i.test(headline)) return "championshipGame";
  if (/College World Series/i.test(headline)) return "cws";
  if (/Super Regional/i.test(headline)) return "superRegional";
  if (/NCAA Baseball Championship/i.test(headline) && /Regional/i.test(headline)) {
    return "regional";
  }
  return null;
}

const PLAYOFF_RANK: Record<string, number> = {
  championshipGame: 100,
  champion: 110,
  runnerUp: 105,
  semifinal: 90,
  finalFour: 90,
  quarterfinal: 80,
  eliteEight: 80,
  sweetSixteen: 70,
  secondRound: 65,
  round32: 60,
  firstRound: 50,
  round64: 50,
  firstFour: 40,
  cws: 85,
  superRegional: 70,
  regional: 50,
};

export function betterPlayoffRound(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return (PLAYOFF_RANK[b] ?? 0) > (PLAYOFF_RANK[a] ?? 0) ? b : a;
}

export function finishRound(playoffRound: string | null, isChampion: boolean, isRunnerUp: boolean, sport: Sport): RoundDef {
  const table = roundsFor(sport);
  if (isChampion) return table.champion;
  if (isRunnerUp) return table.runnerUp;
  if (playoffRound === "championshipGame") return table.runnerUp;
  if (playoffRound === "semifinal" || playoffRound === "finalFour") {
    return table.semifinal ?? table.finalFour;
  }
  if (playoffRound === "quarterfinal" || playoffRound === "eliteEight") {
    return table.quarterfinal ?? table.eliteEight;
  }
  if (playoffRound === "sweetSixteen") return table.sweetSixteen;
  if (playoffRound === "secondRound") return table.secondRound;
  if (playoffRound === "round32") return table.round32;
  if (playoffRound === "firstRound" || playoffRound === "round64") {
    return table.firstRound ?? table.round64;
  }
  if (playoffRound === "firstFour") return table.firstFour;
  if (playoffRound === "cws") return table.cws;
  if (playoffRound === "superRegional") return table.superRegional;
  if (playoffRound === "regional") return table.regional;
  return table.none;
}
