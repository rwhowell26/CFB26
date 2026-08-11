"use client";

import { useEffect, useMemo, useState } from "react";
import { shortConferenceName } from "@/lib/conferences";
import {
  computeSos,
  formatRank,
  gamesForTeam,
  recordFromGames,
} from "@/lib/ranking-logic";
import type { Game, Team, TeamGameView } from "@/lib/types";

type Props = {
  teams: Team[];
  games: Game[];
  /** Prefer resume ranks so unplaced teams still contribute opponent strength */
  ranks: Map<string, number>;
  records: Map<string, { wins: number; losses: number }>;
  search?: string;
};

type SosRow = {
  team: Team;
  totalAvgRank: number;
  playedAvgRank: number | null;
  remainingAvgRank: number | null;
  record: { wins: number; losses: number };
};

function teamMatches(team: Team, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const conf = shortConferenceName(team.conference).toLowerCase();
  return (
    team.name.toLowerCase().includes(q) ||
    team.shortName.toLowerCase().includes(q) ||
    team.abbreviation.toLowerCase().includes(q) ||
    conf.includes(q) ||
    team.conference.toLowerCase().includes(q)
  );
}

function locLabel(location: TeamGameView["location"]) {
  if (location === "home") return "vs";
  if (location === "away") return "@";
  return "n";
}

function SchedulePopup({
  team,
  games,
  ranks,
  sosRank,
  totalSos,
  onClose,
}: {
  team: Team;
  games: Game[];
  ranks: Map<string, number>;
  sosRank: number;
  totalSos: number | null;
  onClose: () => void;
}) {
  const schedule = useMemo(() => gamesForTeam(team.id, games, ranks), [team.id, games, ranks]);
  const record = recordFromGames(team.id, games);
  const teamRank = ranks.get(team.id) ?? null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${team.name} schedule`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="resume-title">
            {team.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo} alt="" className="team-logo lg" />
            ) : null}
            <div>
              <p className="eyebrow">Full schedule</p>
              <h2>
                {teamRank != null ? `#${teamRank} ` : ""}
                {team.name}
              </h2>
              <p>
                {record.wins}-{record.losses} · {shortConferenceName(team.conference)} · SOS #
                {sosRank}
                {totalSos != null ? ` · avg ${totalSos.toFixed(1)}` : ""}
              </p>
            </div>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>

        {!schedule.length ? (
          <div className="empty-state">No games loaded for this team.</div>
        ) : (
          <ul className="game-list modal-schedule">
            {schedule.map((g) => (
              <li
                key={g.gameId}
                className={`game-row ${g.result ? `result-${g.result.toLowerCase()}` : ""}`}
              >
                <span className="game-week">W{g.week}</span>
                <span className="game-loc">{locLabel(g.location)}</span>
                <span className="game-opp">
                  {formatRank(g.opponentRank, g.opponentIsFbs)} {g.opponentName}
                </span>
                <span className="game-score">
                  {g.status === "final" && g.result
                    ? `${g.result} ${g.teamScore}-${g.opponentScore}`
                    : new Date(g.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SosTab({ teams, games, ranks, records, search = "" }: Props) {
  const [mode, setMode] = useState<"total" | "played" | "remaining">("total");
  const [popupTeamId, setPopupTeamId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const built: SosRow[] = [];
    for (const team of teams) {
      const sos = computeSos(team.id, games, ranks);
      const metric =
        mode === "played"
          ? sos.playedAvgRank
          : mode === "remaining"
            ? sos.remainingAvgRank
            : sos.totalAvgRank;
      if (metric == null) continue;
      built.push({
        team,
        totalAvgRank: sos.totalAvgRank ?? metric,
        playedAvgRank: sos.playedAvgRank,
        remainingAvgRank: sos.remainingAvgRank,
        record: records.get(team.id) ?? { wins: 0, losses: 0 },
      });
    }

    const value = (row: SosRow) => {
      if (mode === "played") return row.playedAvgRank ?? 999;
      if (mode === "remaining") return row.remainingAvgRank ?? 999;
      return row.totalAvgRank;
    };

    return built
      .filter((row) => teamMatches(row.team, search))
      .sort((a, b) => value(a) - value(b) || a.team.name.localeCompare(b.team.name));
  }, [teams, games, ranks, records, mode, search]);

  const popupIndex = popupTeamId ? rows.findIndex((r) => r.team.id === popupTeamId) : -1;
  const popupRow = popupIndex >= 0 ? rows[popupIndex] : null;

  return (
    <div className="sos-tab-wrap">
      <section className="panel">
        <header className="panel-header">
          <h2>SOS rankings</h2>
          <p>
            Lower average opponent rank = tougher schedule. Click a team to see their full
            schedule.
          </p>
        </header>
        <div className="sos-mode-tabs">
          {(
            [
              ["total", "Total SOS"],
              ["played", "Played"],
              ["remaining", "Remaining"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={mode === id ? "active" : ""}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        {!rows.length ? (
          <div className="empty-state">
            No SOS data yet. Rank some teams (or save a weekly ballot) so opponent ranks exist.
          </div>
        ) : (
          <ol className="sos-rank-list">
            {rows.map((row, index) => {
              const metric =
                mode === "played"
                  ? row.playedAvgRank
                  : mode === "remaining"
                    ? row.remainingAvgRank
                    : row.totalAvgRank;
              const sosRank = index + 1;
              return (
                <li key={row.team.id}>
                  <button
                    type="button"
                    className={`sos-rank-row ${popupTeamId === row.team.id ? "selected" : ""}`}
                    onClick={() => setPopupTeamId(row.team.id)}
                  >
                    <span className="rank-badge">{sosRank}</span>
                    {row.team.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.team.logo} alt="" className="team-logo" />
                    ) : null}
                    <span className="sos-rank-team">
                      <strong>{row.team.shortName}</strong>
                      <em>
                        {row.record.wins}-{row.record.losses} · SOS #{sosRank}
                      </em>
                    </span>
                    <span className="sos-rank-metrics">
                      <strong>{metric != null ? metric.toFixed(1) : "—"}</strong>
                      <em>avg opp rank</em>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {popupRow ? (
        <SchedulePopup
          team={popupRow.team}
          games={games}
          ranks={ranks}
          sosRank={popupIndex + 1}
          totalSos={popupRow.totalAvgRank}
          onClose={() => setPopupTeamId(null)}
        />
      ) : null}
    </div>
  );
}
