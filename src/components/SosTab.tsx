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

type SosMode = "total" | "played" | "remaining" | "wins" | "losses";

type SosRow = {
  team: Team;
  totalAvgRank: number | null;
  playedAvgRank: number | null;
  remainingAvgRank: number | null;
  winAvgRank: number | null;
  lossAvgRank: number | null;
  winCount: number;
  lossCount: number;
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

function metricForMode(row: SosRow, mode: SosMode): number | null {
  if (mode === "played") return row.playedAvgRank;
  if (mode === "remaining") return row.remainingAvgRank;
  if (mode === "wins") return row.winAvgRank;
  if (mode === "losses") return row.lossAvgRank;
  return row.totalAvgRank;
}

function modeLabel(mode: SosMode): string {
  if (mode === "played") return "Played";
  if (mode === "remaining") return "Remaining";
  if (mode === "wins") return "SOW";
  if (mode === "losses") return "SOL";
  return "SOS";
}

function scheduleSos(row: SosRow, mode: SosMode): number | null {
  if (mode === "played") return row.playedAvgRank;
  if (mode === "remaining") return row.remainingAvgRank;
  return row.totalAvgRank;
}

function scheduleSosLabel(mode: SosMode): string {
  if (mode === "played") return "Played";
  if (mode === "remaining") return "Remain";
  return "SOS";
}

function SchedulePopup({
  team,
  games,
  ranks,
  sosRank,
  row,
  mode,
  onClose,
}: {
  team: Team;
  games: Game[];
  ranks: Map<string, number>;
  sosRank: number;
  row: SosRow;
  mode: SosMode;
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
                {record.wins}-{record.losses} · {shortConferenceName(team.conference)} ·{" "}
                {modeLabel(mode)} #{sosRank}
                {row.totalAvgRank != null ? ` · SOS ${row.totalAvgRank.toFixed(1)}` : ""}
                {row.winAvgRank != null ? ` · SOW ${row.winAvgRank.toFixed(1)}` : ""}
                {row.lossAvgRank != null ? ` · SOL ${row.lossAvgRank.toFixed(1)}` : ""}
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
  const [mode, setMode] = useState<SosMode>("total");
  const [popupTeamId, setPopupTeamId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const built: SosRow[] = [];
    for (const team of teams) {
      const sos = computeSos(team.id, games, ranks);
      const row: SosRow = {
        team,
        totalAvgRank: sos.totalAvgRank,
        playedAvgRank: sos.playedAvgRank,
        remainingAvgRank: sos.remainingAvgRank,
        winAvgRank: sos.winAvgRank,
        lossAvgRank: sos.lossAvgRank,
        winCount: sos.winCount,
        lossCount: sos.lossCount,
        record: records.get(team.id) ?? { wins: 0, losses: 0 },
      };
      if (metricForMode(row, mode) == null) continue;
      built.push(row);
    }

    return built
      .filter((row) => teamMatches(row.team, search))
      .sort(
        (a, b) =>
          (metricForMode(a, mode) ?? 999) - (metricForMode(b, mode) ?? 999) ||
          a.team.name.localeCompare(b.team.name),
      );
  }, [teams, games, ranks, records, mode, search]);

  const popupIndex = popupTeamId ? rows.findIndex((r) => r.team.id === popupTeamId) : -1;
  const popupRow = popupIndex >= 0 ? rows[popupIndex] : null;

  return (
    <div className="sos-tab-wrap">
      <section className="panel">
        <header className="panel-header">
          <h2>SOS rankings</h2>
          <p>
            Lower average opponent rank = tougher. SOW = strength of wins, SOL = strength of
            losses (FCS counts as 139). Click a team for their schedule.
          </p>
        </header>
        <div className="sos-mode-tabs">
          {(
            [
              ["total", "Total SOS"],
              ["played", "Played"],
              ["remaining", "Remaining"],
              ["wins", "SOW"],
              ["losses", "SOL"],
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
          <div className="sos-rank-header" aria-hidden>
            <span />
            <span />
            <span>Team</span>
            <span>{scheduleSosLabel(mode)}</span>
            <span>SOW</span>
            <span>SOL</span>
          </div>
          <ol className="sos-rank-list">
            {rows.map((row, index) => {
              const sosValue = scheduleSos(row, mode);
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
                    ) : (
                      <span className="team-logo team-logo-fallback" aria-hidden>
                        ·
                      </span>
                    )}
                    <span className="sos-rank-team">
                      <strong>{row.team.shortName}</strong>
                      <em>
                        {row.record.wins}-{row.record.losses}
                      </em>
                    </span>
                    <span
                      className={`sos-rank-metrics ${
                        mode === "total" || mode === "played" || mode === "remaining"
                          ? "primary"
                          : ""
                      }`}
                    >
                      <strong>{sosValue != null ? sosValue.toFixed(1) : "—"}</strong>
                      <em>{scheduleSosLabel(mode)}</em>
                    </span>
                    <span className={`sos-rank-metrics ${mode === "wins" ? "primary" : ""}`}>
                      <strong>{row.winAvgRank != null ? row.winAvgRank.toFixed(1) : "—"}</strong>
                      <em>SOW</em>
                    </span>
                    <span className={`sos-rank-metrics ${mode === "losses" ? "primary" : ""}`}>
                      <strong>{row.lossAvgRank != null ? row.lossAvgRank.toFixed(1) : "—"}</strong>
                      <em>SOL</em>
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
          row={popupRow}
          mode={mode}
          onClose={() => setPopupTeamId(null)}
        />
      ) : null}
    </div>
  );
}
