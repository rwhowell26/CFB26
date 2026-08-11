import type {
  Game,
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

  const avg = (list: typeof all) => {
    const ranked = list.filter((g) => g.opponentIsFbs && g.opponentRank != null);
    if (!ranked.length) return null;
    const sum = ranked.reduce((acc, g) => acc + (g.opponentRank as number), 0);
    return sum / ranked.length;
  };

  return {
    playedCount: played.length,
    playedAvgRank: avg(played),
    remainingCount: remaining.length,
    remainingAvgRank: avg(remaining),
    fcsPlayed: played.filter((g) => !g.opponentIsFbs).length,
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

  // Lost to a team ranked below them (should usually sit behind that team)
  for (const game of games) {
    if (game.status !== "final") continue;
    if (!game.homeIsFbs || !game.awayIsFbs) continue;
    if (game.homeScore == null || game.awayScore == null) continue;

    const homeRank = ranks.get(game.homeTeamId);
    const awayRank = ranks.get(game.awayTeamId);
    if (homeRank == null || awayRank == null) continue;

    if (game.homeScore > game.awayScore && homeRank > awayRank) {
      // home beat away, but home ranked worse (higher number)
      warnings.push({
        type: "lost_to_higher",
        teamId: game.awayTeamId,
        relatedTeamId: game.homeTeamId,
        message: `${teamsById.get(game.awayTeamId)?.shortName ?? "Team"} (#${awayRank}) is ranked ahead of ${teamsById.get(game.homeTeamId)?.shortName ?? "team"} (#${homeRank}) after losing to them.`,
      });
    } else if (game.awayScore > game.homeScore && awayRank > homeRank) {
      warnings.push({
        type: "lost_to_higher",
        teamId: game.homeTeamId,
        relatedTeamId: game.awayTeamId,
        message: `${teamsById.get(game.homeTeamId)?.shortName ?? "Team"} (#${homeRank}) is ranked ahead of ${teamsById.get(game.awayTeamId)?.shortName ?? "team"} (#${awayRank}) after losing to them.`,
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

export function formatRank(rank: number | null | undefined, isFbs: boolean): string {
  if (!isFbs) return "FCS";
  if (rank == null) return "NR";
  return `#${rank}`;
}
