"use client";

import { useMemo, useState } from "react";
import { formatGameWeekShort, formatWeekLabel } from "@/lib/season";
import { teamRankHistory } from "@/lib/storage";
import type { RankingStore, Team, WeekSnapshot } from "@/lib/types";

type Props = {
  store: RankingStore;
  teams: Team[];
  onLoadWeek: (week: number) => void;
};

export function HistoryTab({ store, teams, onLoadWeek }: Props) {
  const snapshots = useMemo(
    () => Object.values(store.snapshots).sort((a, b) => a.week - b.week),
    [store.snapshots],
  );
  const [selectedWeek, setSelectedWeek] = useState<number | null>(
    snapshots[snapshots.length - 1]?.week ?? null,
  );
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");

  const snapshot: WeekSnapshot | null = selectedWeek
    ? store.snapshots[String(selectedWeek)] ?? null
    : null;

  const history = teamId ? teamRankHistory(store, teamId) : [];
  const team = teams.find((t) => t.id === teamId);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  return (
    <div className="history-wrap">
      <section className="panel">
        <header className="panel-header">
          <h2>Week history</h2>
          <p>Saved weekly ballots. Each week starts fresh until you save a snapshot.</p>
        </header>
        {!snapshots.length ? (
          <div className="empty-state">No snapshots yet. Rank all 138 and hit Save week.</div>
        ) : (
          <div className="history-controls">
            <label>
              Snapshot week
              <select
                value={selectedWeek ?? ""}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
              >
                {snapshots.map((s) => (
                  <option key={s.week} value={s.week}>
                    {s.label} · saved {new Date(s.updatedAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            {snapshot ? (
              <button type="button" className="primary-btn" onClick={() => onLoadWeek(snapshot.week)}>
                Open {formatWeekLabel(snapshot.week, snapshot.label)} in Rank
              </button>
            ) : null}
          </div>
        )}

        {snapshot ? (
          <ol className="history-rank-list">
            {snapshot.rankedIds.map((id, index) => {
              const t = teamsById.get(id);
              if (!t) return null;
              return (
                <li key={id}>
                  <span className="rank-badge">{index + 1}</span>
                  <span>{t.shortName}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Team rank by week</h2>
          <p>Pick a team to see where they landed in each saved ballot.</p>
        </header>
        <label className="block-label">
          Team
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {sortedTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {!history.length ? (
          <div className="empty-state">Save weekly snapshots to build a trajectory.</div>
        ) : (
          <div className="trajectory">
            <div className="trajectory-header">{team?.shortName} trajectory</div>
            <ul>
              {history.map((h) => (
                <li key={h.week}>
                  <span>{h.label}</span>
                  <strong>{h.rank != null ? `#${h.rank}` : "—"}</strong>
                </li>
              ))}
            </ul>
            <div className="sparkline" aria-hidden>
              {history.map((h) => {
                const pct = h.rank == null ? 100 : ((h.rank - 1) / 137) * 100;
                return (
                  <div
                    key={h.week}
                    className="spark-col"
                    title={`${formatWeekLabel(h.week, h.label)}: #${h.rank}`}
                  >
                    <div className="spark-bar" style={{ height: `${Math.max(8, 100 - pct)}%` }} />
                    <span>{formatGameWeekShort(h.week)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
