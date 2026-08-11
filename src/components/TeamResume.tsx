"use client";

import {
  computeSos,
  formatRank,
  gamesForTeam,
  recordFromGames,
} from "@/lib/ranking-logic";
import type { Game, Team } from "@/lib/types";

type Props = {
  team: Team;
  games: Game[];
  ranks: Map<string, number>;
  onClose?: () => void;
};

function locLabel(location: "home" | "away" | "neutral") {
  if (location === "home") return "vs";
  if (location === "away") return "@";
  return "n";
}

export function TeamResume({ team, games, ranks, onClose }: Props) {
  const played = gamesForTeam(team.id, games, ranks, { playedOnly: true });
  const upcoming = gamesForTeam(team.id, games, ranks).filter((g) => g.status !== "final");
  const record = recordFromGames(team.id, games);
  const sos = computeSos(team.id, games, ranks);
  const rank = ranks.get(team.id) ?? null;

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
              {rank != null ? `#${rank} ` : ""}
              {team.name}
            </h2>
            <p>
              {record.wins}-{record.losses} · {team.conference}
            </p>
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
          <em>{sos.playedCount} games{sos.fcsPlayed ? ` · ${sos.fcsPlayed} FCS` : ""}</em>
        </div>
        <div>
          <span className="sos-label">SOS remaining</span>
          <strong>
            {sos.remainingAvgRank != null ? sos.remainingAvgRank.toFixed(1) : "—"}
          </strong>
          <em>{sos.remainingCount} left</em>
        </div>
      </div>

      <h3 className="section-label">Played</h3>
      {played.length ? (
        <ul className="game-list">
          {played.map((g) => (
            <li key={g.gameId} className={`game-row result-${g.result?.toLowerCase()}`}>
              <span className="game-week">W{g.week}</span>
              <span className="game-loc">{locLabel(g.location)}</span>
              <span className="game-opp">
                {formatRank(g.opponentRank, g.opponentIsFbs)} {g.opponentName}
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
                {formatRank(g.opponentRank, g.opponentIsFbs)} {g.opponentName}
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
