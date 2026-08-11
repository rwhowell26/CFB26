"use client";

import { useMemo, useState } from "react";
import { normalizeConferenceName, shortConferenceName } from "@/lib/conferences";
import { computeSos } from "@/lib/ranking-logic";
import type { Game, Team } from "@/lib/types";

type Props = {
  teams: Team[];
  games: Game[];
  /** Prefer resume ranks so unplaced teams still contribute opponent strength */
  ranks: Map<string, number>;
  records: Map<string, { wins: number; losses: number }>;
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
  search?: string;
};

type SosRow = {
  team: Team;
  totalAvgRank: number;
  playedAvgRank: number | null;
  remainingAvgRank: number | null;
  fbsOpponentCount: number;
  conferenceRank: number | null;
  record: { wins: number; losses: number };
  overallRank: number | null;
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

function conferenceRanksFor(
  teams: Team[],
  ranks: Map<string, number>,
): Map<string, number> {
  const byConf = new Map<string, Team[]>();
  for (const team of teams) {
    const key = normalizeConferenceName(team.conference);
    const list = byConf.get(key) ?? [];
    list.push(team);
    byConf.set(key, list);
  }

  const confRanks = new Map<string, number>();
  for (const members of byConf.values()) {
    const ordered = [...members].sort((a, b) => {
      const ar = ranks.get(a.id);
      const br = ranks.get(b.id);
      if (ar != null && br != null) return ar - br;
      if (ar != null) return -1;
      if (br != null) return 1;
      return a.name.localeCompare(b.name);
    });
    ordered.forEach((team, index) => {
      if (ranks.has(team.id)) confRanks.set(team.id, index + 1);
    });
  }
  return confRanks;
}

export function SosTab({
  teams,
  games,
  ranks,
  records,
  onSelectTeam,
  selectedTeamId,
  search = "",
}: Props) {
  const [mode, setMode] = useState<"total" | "played" | "remaining">("total");
  const conferenceRanks = useMemo(() => conferenceRanksFor(teams, ranks), [teams, ranks]);

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
        fbsOpponentCount: sos.fbsOpponentCount,
        conferenceRank: conferenceRanks.get(team.id) ?? null,
        record: records.get(team.id) ?? { wins: 0, losses: 0 },
        overallRank: ranks.get(team.id) ?? null,
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
  }, [teams, games, ranks, records, mode, search, conferenceRanks]);

  return (
    <div className="sos-tab-wrap">
      <section className="panel">
        <header className="panel-header">
          <h2>SOS rankings</h2>
          <p>
            Lower average opponent rank = tougher schedule. Based on your ballot ranks (with last
            saved fallback for unplaced teams).
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
              const conf = shortConferenceName(row.team.conference);
              return (
                <li key={row.team.id}>
                  <button
                    type="button"
                    className={`sos-rank-row ${selectedTeamId === row.team.id ? "selected" : ""}`}
                    onClick={() => onSelectTeam?.(row.team.id)}
                  >
                    <span className="rank-badge">{index + 1}</span>
                    {row.team.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.team.logo} alt="" className="team-logo" />
                    ) : null}
                    <span className="sos-rank-team">
                      <strong>{row.team.shortName}</strong>
                      <em>
                        {conf} · {row.record.wins}-{row.record.losses}
                        {row.overallRank != null ? ` · ballot #${row.overallRank}` : " · NR"}
                      </em>
                    </span>
                    <span className="sos-rank-metrics">
                      <strong>{metric != null ? metric.toFixed(1) : "—"}</strong>
                      <em>
                        {row.fbsOpponentCount} FBS
                        {row.conferenceRank != null
                          ? ` · #${row.conferenceRank} ${conf}`
                          : ` · NR ${conf}`}
                      </em>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
