"use client";

import { useMemo, useState } from "react";
import {
  computeSos,
  formatRank,
  gamesForTeam,
  recordFromGames,
} from "@/lib/ranking-logic";
import type { Game, Team } from "@/lib/types";

type Props = {
  teams: Team[];
  games: Game[];
  ranks: Map<string, number>;
};

export function CompareTool({ teams, games, ranks }: Props) {
  const [leftId, setLeftId] = useState(teams[0]?.id ?? "");
  const [rightId, setRightId] = useState(teams[1]?.id ?? "");

  const sorted = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  const left = teams.find((t) => t.id === leftId);
  const right = teams.find((t) => t.id === rightId);

  if (!left || !right) {
    return <div className="empty-state">Need teams to compare.</div>;
  }

  const cards = [left, right].map((team) => {
    const played = gamesForTeam(team.id, games, ranks, { playedOnly: true });
    const record = recordFromGames(team.id, games);
    const sos = computeSos(team.id, games, ranks);
    return { team, played, record, sos, rank: ranks.get(team.id) ?? null };
  });

  return (
    <div className="compare-wrap">
      <div className="compare-controls">
        <label>
          Team A
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Team B
          <select value={rightId} onChange={(e) => setRightId(e.target.value)}>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="compare-grid">
        {cards.map(({ team, played, record, sos, rank }) => (
          <section key={team.id} className="panel">
            <header className="panel-header">
              <h2>
                {rank != null ? `#${rank} ` : "NR "}
                {team.shortName}
              </h2>
              <p>
                {record.wins}-{record.losses} · SOS{" "}
                {sos.playedAvgRank != null ? sos.playedAvgRank.toFixed(1) : "—"}
                {sos.winAvgRank != null ? ` · SOW ${sos.winAvgRank.toFixed(1)}` : ""}
                {sos.lossAvgRank != null ? ` · SOL ${sos.lossAvgRank.toFixed(1)}` : ""}
              </p>
            </header>
            <ul className="game-list">
              {played.map((g) => (
                <li key={g.gameId} className={`game-row result-${g.result?.toLowerCase()}`}>
                  <span className="game-week">W{g.week}</span>
                  <span className="game-loc">
                    {g.location === "home" ? "vs" : g.location === "away" ? "@" : "n"}
                  </span>
                  <span className="game-opp">
                    {formatRank(g.opponentRank, g.opponentIsFbs)} {g.opponentName}
                  </span>
                  <span className="game-score">
                    {g.result} {g.teamScore}-{g.opponentScore}
                  </span>
                </li>
              ))}
              {!played.length && <li className="empty-state">No games played.</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
