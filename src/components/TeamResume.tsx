"use client";

import {
  computeSos,
  formatResumeRank,
  gamesForTeam,
  recordFromGames,
} from "@/lib/ranking-logic";
import type { PriorRank, ResumeRank } from "@/lib/storage";
import { resolveResumeRank } from "@/lib/storage";
import type { Game, Team } from "@/lib/types";

type Props = {
  team: Team;
  games: Game[];
  /** Current-week ballot ranks only */
  currentRanks: Map<string, number>;
  /** Most recent saved snapshot ranks */
  priorRanks: Map<string, PriorRank>;
  /** Effective ranks for SOS / opponent display (current with prior fallback) */
  resumeRanks: Map<string, number>;
  onClose?: () => void;
};

function locLabel(location: "home" | "away" | "neutral") {
  if (location === "home") return "vs";
  if (location === "away") return "@";
  return "n";
}

function rankCaption(resolved: ResumeRank | null): string {
  if (!resolved) return "Not ranked yet";
  if (resolved.source === "prior") {
    return `Last saved ${resolved.label ?? `Week ${resolved.week}`} · not on this week's ballot yet`;
  }
  return "This week's ballot";
}

export function TeamResume({
  team,
  games,
  currentRanks,
  priorRanks,
  resumeRanks,
  onClose,
}: Props) {
  const played = gamesForTeam(team.id, games, resumeRanks, { playedOnly: true });
  const upcoming = gamesForTeam(team.id, games, resumeRanks).filter((g) => g.status !== "final");
  const record = recordFromGames(team.id, games);
  const sos = computeSos(team.id, games, resumeRanks);
  const teamResolved = resolveResumeRank(team.id, currentRanks, priorRanks);

  const oppLabel = (opponentId: string | null, opponentIsFbs: boolean) => {
    if (!opponentIsFbs || !opponentId) {
      return formatResumeRank(null, opponentIsFbs);
    }
    return formatResumeRank(
      resolveResumeRank(opponentId, currentRanks, priorRanks),
      true,
    );
  };

  return (
    <section className="panel resume-panel">
      <header className="panel-header resume-header">
        <div className="resume-title">
          {team.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt="" className="team-logo lg" />
          ) : null}
          <div>
            <p className="eyebrow">Team resume · games played</p>
            <h2>
              {teamResolved ? `${formatResumeRank(teamResolved, true)} ` : ""}
              {team.name}
            </h2>
            <p>
              {record.wins}-{record.losses} · {team.conference}
            </p>
            <p className="resume-rank-note">{rankCaption(teamResolved)}</p>
          </div>
        </div>
        {onClose ? (
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        ) : null}
      </header>

      <div className="sos-grid">
        <div>
          <span className="sos-label">SOS played</span>
          <strong>
            {sos.playedAvgRank != null ? sos.playedAvgRank.toFixed(1) : "—"}
          </strong>
          <em>
            {sos.playedCount} games{sos.fcsPlayed ? ` · ${sos.fcsPlayed} FCS` : ""}
          </em>
        </div>
        <div>
          <span className="sos-label">SOS remaining</span>
          <strong>
            {sos.remainingAvgRank != null ? sos.remainingAvgRank.toFixed(1) : "—"}
          </strong>
          <em>{sos.remainingCount} left</em>
        </div>
      </div>
      <p className="resume-rank-note">
        Opponent ranks use this week&apos;s ballot when placed; otherwise the latest saved week
        (`#12·W3`).
      </p>

      <h3 className="section-label">Played</h3>
      {played.length ? (
        <ul className="game-list">
          {played.map((g) => (
            <li key={g.gameId} className={`game-row result-${g.result?.toLowerCase()}`}>
              <span className="game-week">W{g.week}</span>
              <span className="game-loc">{locLabel(g.location)}</span>
              <span className="game-opp">
                {oppLabel(g.opponentId, g.opponentIsFbs)} {g.opponentName}
              </span>
              <span className="game-score">
                {g.result} {g.teamScore}-{g.opponentScore}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">No games played yet this season.</div>
      )}

      <h3 className="section-label">Upcoming</h3>
      {upcoming.length ? (
        <ul className="game-list muted">
          {upcoming.slice(0, 6).map((g) => (
            <li key={g.gameId} className="game-row">
              <span className="game-week">W{g.week}</span>
              <span className="game-loc">{locLabel(g.location)}</span>
              <span className="game-opp">
                {oppLabel(g.opponentId, g.opponentIsFbs)} {g.opponentName}
              </span>
              <span className="game-score">
                {new Date(g.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">No upcoming games loaded.</div>
      )}
    </section>
  );
}
