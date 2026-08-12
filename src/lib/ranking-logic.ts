import { FCS_SOS_RANK } from "./season";
import type {
  Game,
  MoveSuggestion,
  PhilosophyWarning,
  SosSummary,
  Team,
  TeamGameView,
} from "./types";

export function rankMapFromOrder(rankedIds: string[]): Map<string, number> {
  const map = new Map<string, number>();
  rankedIds.forEach((id, index) => {
    map.set(id, index + 1);
  });
  return map;
}

export function recordFromGames(
  teamId: string,
  games: Game[],
): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (const game of games) {
    if (game.status !== "final") continue;
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;
    const isHome = game.homeTeamId === teamId;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;
    if (teamScore == null || oppScore == null) continue;
    if (teamScore > oppScore) wins += 1;
    else if (teamScore < oppScore) losses += 1;
  }
  return { wins, losses };
}

/** Negative => a belongs above b (better record). */
export function compareRecords(
  a: { wins: number; losses: number },
  b: { wins: number; losses: number },
): number {
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.losses !== b.losses) return a.losses - b.losses;
  const aPlayed = a.wins + a.losses;
  const bPlayed = b.wins + b.losses;
  if (aPlayed !== bPlayed && aPlayed > 0 && bPlayed > 0) {
    const aPct = a.wins / aPlayed;
    const bPct = b.wins / bPlayed;
    if (aPct !== bPct) return bPct - aPct;
  }
  return 0;
}

export function sortTeamIdsByRecord(
  teamIds: string[],
  records: Map<string, { wins: number; losses: number }>,
  nameFor?: (id: string) => string,
): string[] {
  return [...teamIds].sort((left, right) => {
    const cmp = compareRecords(
      records.get(left) ?? { wins: 0, losses: 0 },
      records.get(right) ?? { wins: 0, losses: 0 },
    );
    if (cmp !== 0) return cmp;
    const leftName = nameFor?.(left) ?? left;
    const rightName = nameFor?.(right) ?? right;
    return leftName.localeCompare(rightName);
  });
}

/** Index to insert teamId so better records stay higher in the ballot. */
export function insertIndexByRecord(
  rankedIds: string[],
  teamId: string,
  records: Map<string, { wins: number; losses: number }>,
): number {
  const incoming = records.get(teamId) ?? { wins: 0, losses: 0 };
  for (let i = 0; i < rankedIds.length; i++) {
    const current = records.get(rankedIds[i]) ?? { wins: 0, losses: 0 };
    if (compareRecords(incoming, current) < 0) return i;
  }
  return rankedIds.length;
}

export function gamesForTeam(
  teamId: string,
  games: Game[],
  ranks: Map<string, number>,
  options?: { playedOnly?: boolean },
): TeamGameView[] {
  const playedOnly = options?.playedOnly ?? false;
  const views: TeamGameView[] = [];

  for (const game of games) {
    const isHome = game.homeTeamId === teamId;
    const isAway = game.awayTeamId === teamId;
    if (!isHome && !isAway) continue;
    if (playedOnly && game.status !== "final") continue;

    const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
    const opponentName = isHome ? game.awayName : game.homeName;
    const opponentLogo = isHome ? game.awayLogo : game.homeLogo;
    const opponentIsFbs = isHome ? game.awayIsFbs : game.homeIsFbs;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const opponentScore = isHome ? game.awayScore : game.homeScore;

    let result: "W" | "L" | null = null;
    if (game.status === "final" && teamScore != null && opponentScore != null) {
      if (teamScore > opponentScore) result = "W";
      else if (teamScore < opponentScore) result = "L";
    }

    let location: "home" | "away" | "neutral" = isHome ? "home" : "away";
    if (game.neutralSite) location = "neutral";

    views.push({
      gameId: game.id,
      week: game.week,
      date: game.date,
      location,
      opponentId: opponentIsFbs ? opponentId : null,
      opponentName,
      opponentLogo,
      opponentIsFbs,
      opponentRank: opponentIsFbs ? ranks.get(opponentId) ?? null : null,
      result,
      teamScore,
      opponentScore,
      status: game.status,
    });
  }

  views.sort((a, b) => a.week - b.week || a.date.localeCompare(b.date));
  return views;
}

export function computeSos(
  teamId: string,
  games: Game[],
  ranks: Map<string, number>,
): SosSummary {
  const all = gamesForTeam(teamId, games, ranks);
  const played = all.filter((g) => g.status === "final");
  const remaining = all.filter((g) => g.status !== "final");
  const wins = played.filter((g) => g.result === "W");
  const losses = played.filter((g) => g.result === "L");

  /** FCS counts as 139 for SOS / SOW / SOL; schedule UI still shows "FCS" with no rank. */
  const sosOpponentRank = (g: TeamGameView): number | null => {
    if (!g.opponentIsFbs) return FCS_SOS_RANK;
    return g.opponentRank ?? null;
  };

  const avg = (list: typeof all) => {
    const values = list
      .map(sosOpponentRank)
      .filter((rank): rank is number => rank != null);
    if (!values.length) return null;
    return values.reduce((acc, rank) => acc + rank, 0) / values.length;
  };

  const fbsWithRank = all.filter((g) => g.opponentIsFbs && g.opponentRank != null);

  return {
    playedCount: played.length,
    playedAvgRank: avg(played),
    remainingCount: remaining.length,
    remainingAvgRank: avg(remaining),
    totalCount: all.length,
    totalAvgRank: avg(all),
    winAvgRank: avg(wins),
    winCount: wins.length,
    lossAvgRank: avg(losses),
    lossCount: losses.length,
    fbsOpponentCount: fbsWithRank.length,
    fcsPlayed: played.filter((g) => !g.opponentIsFbs).length,
    fcsTotal: all.filter((g) => !g.opponentIsFbs).length,
  };
}

export function philosophyWarnings(
  rankedIds: string[],
  teamsById: Map<string, Team>,
  games: Game[],
): PhilosophyWarning[] {
  const ranks = rankMapFromOrder(rankedIds);
  const warnings: PhilosophyWarning[] = [];
  const records = new Map<string, { wins: number; losses: number }>();

  for (const id of rankedIds) {
    records.set(id, recordFromGames(id, games));
  }

  for (const game of games) {
    if (game.status !== "final") continue;
    if (!game.homeIsFbs || !game.awayIsFbs) continue;
    if (game.homeScore == null || game.awayScore == null) continue;

    const homeRank = ranks.get(game.homeTeamId);
    const awayRank = ranks.get(game.awayTeamId);
    if (homeRank == null || awayRank == null) continue;

    let winnerId: string | null = null;
    let loserId: string | null = null;
    if (game.homeScore > game.awayScore) {
      winnerId = game.homeTeamId;
      loserId = game.awayTeamId;
    } else if (game.awayScore > game.homeScore) {
      winnerId = game.awayTeamId;
      loserId = game.homeTeamId;
    }
    if (!winnerId || !loserId) continue;

    const winnerRank = ranks.get(winnerId)!;
    const loserRank = ranks.get(loserId)!;
    if (loserRank < winnerRank) {
      warnings.push({
        type: "lost_to_higher",
        teamId: loserId,
        relatedTeamId: winnerId,
        message: `${teamsById.get(loserId)?.shortName ?? "Team"} (#${loserRank}) is ranked ahead of ${teamsById.get(winnerId)?.shortName ?? "team"} (#${winnerRank}) after losing to them.`,
      });
    }
  }

  // Undefeated behind a team with a loss (rare exception allowed, but flag it)
  for (let i = 0; i < rankedIds.length; i++) {
    const id = rankedIds[i];
    const rec = records.get(id);
    if (!rec || rec.wins === 0 || rec.losses !== 0) continue;
    for (let j = 0; j < i; j++) {
      const aboveId = rankedIds[j];
      const aboveRec = records.get(aboveId);
      if (!aboveRec) continue;
      if (aboveRec.losses > 0 && aboveRec.wins + aboveRec.losses > 0) {
        warnings.push({
          type: "undefeated_behind_loss",
          teamId: id,
          relatedTeamId: aboveId,
          message: `Undefeated ${teamsById.get(id)?.shortName ?? "team"} (#${i + 1}) is behind ${teamsById.get(aboveId)?.shortName ?? "team"} (#${j + 1}) who has a loss.`,
        });
        break;
      }
    }
  }

  // Winless teams should sit near the bottom among teams that have played
  const withGames = rankedIds
    .map((id, index) => ({ id, index, rec: records.get(id)! }))
    .filter((t) => t.rec.wins + t.rec.losses > 0);

  if (withGames.length) {
    const winless = withGames.filter((t) => t.rec.wins === 0);
    const withWins = withGames.filter((t) => t.rec.wins > 0);
    if (winless.length && withWins.length) {
      const lowestWinIndex = Math.max(...withWins.map((t) => t.index));
      for (const w of winless) {
        if (w.index < lowestWinIndex) {
          warnings.push({
            type: "winless_not_bottom",
            teamId: w.id,
            message: `Winless ${teamsById.get(w.id)?.shortName ?? "team"} (#${w.index + 1}) is ranked above a team that has a win.`,
          });
        }
      }
    }
  }

  return warnings;
}

/** Head-to-head result conflicts: ahead after a loss, or behind after a win. */
export function resultMoveSuggestions(
  rankedIds: string[],
  teamsById: Map<string, Team>,
  games: Game[],
): MoveSuggestion[] {
  const ranks = rankMapFromOrder(rankedIds);
  const suggestions: MoveSuggestion[] = [];
  const seen = new Set<string>();

  for (const game of games) {
    if (game.status !== "final") continue;
    if (!game.homeIsFbs || !game.awayIsFbs) continue;
    if (game.homeScore == null || game.awayScore == null) continue;

    let winnerId: string | null = null;
    let loserId: string | null = null;
    if (game.homeScore > game.awayScore) {
      winnerId = game.homeTeamId;
      loserId = game.awayTeamId;
    } else if (game.awayScore > game.homeScore) {
      winnerId = game.awayTeamId;
      loserId = game.homeTeamId;
    }
    if (!winnerId || !loserId) continue;

    const winnerRank = ranks.get(winnerId);
    const loserRank = ranks.get(loserId);
    if (winnerRank == null || loserRank == null) continue;
    // Conflict only when loser is ranked ahead of winner
    if (loserRank < winnerRank) {
      const pairKey = `${winnerId}:${loserId}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const winnerName = teamsById.get(winnerId)?.shortName ?? "Winner";
      const loserName = teamsById.get(loserId)?.shortName ?? "Loser";

      suggestions.push({
        id: `loss-${pairKey}`,
        type: "ahead_after_loss",
        teamId: loserId,
        relatedTeamId: winnerId,
        winnerId,
        loserId,
        teamRank: loserRank,
        relatedRank: winnerRank,
        message: `${loserName} (#${loserRank}) is ahead of ${winnerName} (#${winnerRank}) after losing to them.`,
        actionLabel: `Drop ${loserName} below ${winnerName}`,
      });

      suggestions.push({
        id: `win-${pairKey}`,
        type: "behind_after_win",
        teamId: winnerId,
        relatedTeamId: loserId,
        winnerId,
        loserId,
        teamRank: winnerRank,
        relatedRank: loserRank,
        message: `${winnerName} (#${winnerRank}) is behind ${loserName} (#${loserRank}) after beating them.`,
        actionLabel: `Raise ${winnerName} above ${loserName}`,
      });
    }
  }

  suggestions.sort((a, b) => {
    if (a.type !== b.type) return a.type === "ahead_after_loss" ? -1 : 1;
    return a.teamRank - b.teamRank;
  });

  return suggestions;
}

/** Put the winner immediately above the loser on the ballot. */
export function applyWinnerAboveLoser(
  rankedIds: string[],
  winnerId: string,
  loserId: string,
): string[] {
  if (winnerId === loserId) return rankedIds;
  const winnerIdx = rankedIds.indexOf(winnerId);
  const loserIdx = rankedIds.indexOf(loserId);
  if (winnerIdx < 0 || loserIdx < 0) return rankedIds;
  if (winnerIdx < loserIdx) return rankedIds;

  const next = rankedIds.filter((id) => id !== winnerId);
  const newLoserIdx = next.indexOf(loserId);
  next.splice(newLoserIdx, 0, winnerId);
  return next;
}

export type SlateGameView = {
  game: Game;
  homeRank: number | null;
  awayRank: number | null;
  interest: number;
};

function slateRankValue(
  teamId: string,
  isFbs: boolean,
  ranks: Map<string, number>,
): number {
  if (!isFbs) return FCS_SOS_RANK;
  return ranks.get(teamId) ?? FCS_SOS_RANK;
}

export function scoreSlateGame(game: Game, ranks: Map<string, number>): number {
  const home = slateRankValue(game.homeTeamId, game.homeIsFbs, ranks);
  const away = slateRankValue(game.awayTeamId, game.awayIsFbs, ranks);
  const quality = FCS_SOS_RANK * 2 - (home + away);
  const closeness = FCS_SOS_RANK - Math.abs(home - away);
  const bothFbs = game.homeIsFbs && game.awayIsFbs ? 40 : 0;
  return quality * 2 + closeness + bothFbs;
}

export function gamesForSlateWeek(
  games: Game[],
  weekNumber: number,
  ranks: Map<string, number>,
): SlateGameView[] {
  return games
    .filter((g) => g.week === weekNumber)
    .map((game) => ({
      game,
      homeRank: game.homeIsFbs ? ranks.get(game.homeTeamId) ?? null : null,
      awayRank: game.awayIsFbs ? ranks.get(game.awayTeamId) ?? null : null,
      interest: scoreSlateGame(game, ranks),
    }))
    .sort((a, b) => {
      const dateCmp = a.game.date.localeCompare(b.game.date);
      if (dateCmp !== 0) return dateCmp;
      return b.interest - a.interest;
    });
}

export function formatRank(rank: number | null | undefined, isFbs: boolean): string {
  if (!isFbs) return "FCS";
  if (rank == null) return "NR";
  return `#${rank}`;
}

export function formatResumeRank(
  resolved: { rank: number; source: "current" | "prior"; week?: number } | null,
  isFbs: boolean,
): string {
  if (!isFbs) return "FCS";
  if (!resolved) return "NR";
  if (resolved.source === "prior") {
    return `#${resolved.rank}·W${resolved.week ?? "?"}`;
  }
  return `#${resolved.rank}`;
}
