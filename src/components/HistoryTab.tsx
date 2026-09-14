"use client";

import { useEffect, useMemo, useState } from "react";
import { HistoryChart, type HistorySeries } from "@/components/HistoryChart";
import { shortConferenceName } from "@/lib/conferences";
import { formatWeekLabel } from "@/lib/season";
import { ballotWeeks, teamRankHistory } from "@/lib/storage";
import type { RankingStore, Team } from "@/lib/types";

type Props = {
  store: RankingStore;
  teams: Team[];
  onLoadWeek: (week: number) => void;
};

const HISTORY_SELECTED_KEY = "cfb26-history-selected-teams";
const MAX_TEAMS = 8;
const TEAM_COLORS = [
  "#1f6b45",
  "#8a4b16",
  "#2c4c8c",
  "#8f2d2d",
  "#6b3fa0",
  "#0e7490",
  "#b45309",
  "#365314",
];

function loadSelectedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_SELECTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function teamMatches(team: Team, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const conf = shortConferenceName(team.conference).toLowerCase();
  return (
    team.name.toLowerCase().includes(q) ||
    team.shortName.toLowerCase().includes(q) ||
    team.abbreviation.toLowerCase().includes(q) ||
    conf.includes(q) ||
    team.conference.toLowerCase().includes(q)
  );
}

function deltaLabel(current: number | null, previous: number | null): { text: string; dir: "up" | "down" | "flat" } | null {
  if (current == null || previous == null) return null;
  const delta = previous - current;
  if (delta > 0) return { text: `▲ ${delta}`, dir: "up" };
  if (delta < 0) return { text: `▼ ${Math.abs(delta)}`, dir: "down" };
  return { text: "—", dir: "flat" };
}

function TeamMark({ team }: { team: Team }) {
  if (team.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={team.logo} alt="" className="team-logo" />
    );
  }
  return (
    <span className="team-logo team-logo-fallback" aria-hidden>
      {team.abbreviation.slice(0, 2)}
    </span>
  );
}

export function HistoryTab({ store, teams, onLoadWeek }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );
  const weeks = useMemo(() => ballotWeeks(store), [store]);

  const selectedTeams = useMemo(
    () => selectedIds.map((id) => teamsById.get(id)).filter((t): t is Team => Boolean(t)),
    [selectedIds, teamsById],
  );

  useEffect(() => {
    setSelectedIds(loadSelectedIds());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!teams.length) return;
    const valid = selectedIds.filter((id) => teamsById.has(id));
    if (valid.length !== selectedIds.length) setSelectedIds(valid);
  }, [selectedIds, teamsById, teams.length]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(HISTORY_SELECTED_KEY, JSON.stringify(selectedIds));
  }, [selectedIds, ready]);

  const focusedTeam =
    selectedTeams.length > 0
      ? selectedTeams[Math.min(focusIndex, selectedTeams.length - 1)]
      : null;
  const focusedHistory = focusedTeam ? teamRankHistory(store, focusedTeam.id) : [];
  const focusedByWeek = useMemo(
    () => new Map(focusedHistory.map((p) => [p.week, p])),
    [focusedHistory],
  );

  const series: HistorySeries[] = useMemo(
    () =>
      selectedTeams.map((team, index) => ({
        teamId: team.id,
        name: team.shortName,
        color: TEAM_COLORS[index % TEAM_COLORS.length],
        points: teamRankHistory(store, team.id),
        focused: focusedTeam?.id === team.id,
      })),
    [selectedTeams, store, focusedTeam?.id],
  );

  const suggestions = useMemo(() => {
    const selected = new Set(selectedIds);
    return sortedTeams
      .filter((t) => !selected.has(t.id) && teamMatches(t, query))
      .slice(0, 10);
  }, [sortedTeams, selectedIds, query]);

  function addTeam(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id) || prev.length >= MAX_TEAMS) return prev;
      const next = [...prev, id];
      setFocusIndex(next.length - 1);
      return next;
    });
    setQuery("");
  }

  function removeTeam(id: string) {
    setSelectedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      setFocusIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }

  function cycle(dir: -1 | 1) {
    if (selectedTeams.length < 2) return;
    setFocusIndex((i) => (i + dir + selectedTeams.length) % selectedTeams.length);
  }

  const hoverPoint = hoveredWeek == null ? null : focusedByWeek.get(hoveredWeek) ?? null;
  const legendWeek = hoveredWeek ?? weeks[weeks.length - 1];
  const listFocusIndex = focusedTeam
    ? Math.min(focusIndex, selectedTeams.length - 1)
    : 0;

  return (
    <div className="history-page">
      <section className="panel">
        <header className="panel-header">
          <h2>Team history</h2>
          <p>
            Plot one or more teams across your weekly ballots. Rank 1 is at the top of the
            chart.
          </p>
        </header>

        <label className="block-label">
          Add a team
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions[0]) {
                e.preventDefault();
                addTeam(suggestions[0].id);
              }
            }}
            placeholder="Search name, abbreviation, or conference"
            disabled={selectedIds.length >= MAX_TEAMS}
          />
        </label>

        {query.trim() ? (
          suggestions.length ? (
            <ul className="history-suggest">
              {suggestions.map((team) => (
                <li key={team.id}>
                  <button type="button" onClick={() => addTeam(team.id)}>
                    <TeamMark team={team} />
                    <span>
                      <strong>{team.shortName}</strong>
                      <em>{shortConferenceName(team.conference)}</em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">No matching unselected teams.</div>
          )
        ) : null}

        {selectedTeams.length ? (
          <div className="history-chips">
            {selectedTeams.map((team, index) => {
              const color = TEAM_COLORS[index % TEAM_COLORS.length];
              const focused = focusedTeam?.id === team.id;
              return (
                <div key={team.id} className={`history-chip ${focused ? "focused" : ""}`}>
                  <button
                    type="button"
                    className="history-chip-main"
                    onClick={() => setFocusIndex(index)}
                  >
                    <span className="history-swatch" style={{ background: color }} />
                    <TeamMark team={team} />
                    {team.shortName}
                  </button>
                  <button
                    type="button"
                    className="history-chip-remove"
                    aria-label={`Remove ${team.shortName}`}
                    onClick={() => removeTeam(team.id)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button type="button" className="ghost-btn" onClick={() => setSelectedIds([])}>
              Clear
            </button>
          </div>
        ) : (
          <div className="empty-state">Search above to add teams. You can plot up to {MAX_TEAMS}.</div>
        )}
      </section>

      {!weeks.length ? (
        <section className="panel">
          <div className="empty-state">
            No weekly ballots yet. Rank teams and save a week to start a trajectory.
          </div>
        </section>
      ) : !focusedTeam ? null : (
        <div className="history-stage">
          <section className="panel history-list-panel">
            <header className="history-list-header">
              {selectedTeams.length > 1 ? (
                <button
                  type="button"
                  className="ghost-btn history-cycle"
                  onClick={() => cycle(-1)}
                  aria-label="Previous selected team"
                >
                  ‹
                </button>
              ) : null}
              <div className="history-focus">
                <TeamMark team={focusedTeam} />
                <div>
                  <h2>{focusedTeam.shortName}</h2>
                  <p>
                    {selectedTeams.length > 1
                      ? `${listFocusIndex + 1} of ${selectedTeams.length}`
                      : shortConferenceName(focusedTeam.conference)}
                  </p>
                </div>
              </div>
              {selectedTeams.length > 1 ? (
                <button
                  type="button"
                  className="ghost-btn history-cycle"
                  onClick={() => cycle(1)}
                  aria-label="Next selected team"
                >
                  ›
                </button>
              ) : null}
            </header>

            <ul className="history-week-list">
              {weeks.map((week, index) => {
                const point = focusedByWeek.get(week);
                const prev = index > 0 ? focusedByWeek.get(weeks[index - 1]) : null;
                const delta = deltaLabel(point?.rank ?? null, prev?.rank ?? null);
                const active = hoveredWeek === week;
                return (
                  <li key={week}>
                    <button
                      type="button"
                      className={`history-week-row ${active ? "hovered" : ""}`}
                      onMouseEnter={() => setHoveredWeek(week)}
                      onMouseLeave={() => setHoveredWeek(null)}
                      onClick={() => onLoadWeek(week)}
                    >
                      <span className="history-week-label">
                        {formatWeekLabel(week, point?.label)}
                        {point?.source === "draft" ? <em>unsaved</em> : null}
                      </span>
                      <strong>{point?.rank != null ? `#${point.rank}` : "NR"}</strong>
                      {delta ? (
                        <span className={`movers-delta ${delta.dir}`}>{delta.text}</span>
                      ) : (
                        <span className="movers-delta flat"> </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="history-hint">Click a week to open that ballot in Rank.</p>
          </section>

          <section className="panel history-chart-panel">
            <header className="panel-header">
              <h2>Rank over time</h2>
              <p>
                {hoverPoint
                  ? `${formatWeekLabel(hoverPoint.week, hoverPoint.label)} · ${
                      hoverPoint.rank != null ? `#${hoverPoint.rank}` : "NR"
                    } ${focusedTeam.shortName}`
                  : "Hover a week to compare. Click a line to focus that team."}
              </p>
            </header>
            <HistoryChart
              weeks={weeks}
              series={series}
              hoveredWeek={hoveredWeek}
              onHoverWeek={setHoveredWeek}
              onFocusTeam={(id) => {
                const idx = selectedIds.indexOf(id);
                if (idx >= 0) setFocusIndex(idx);
              }}
            />
            {legendWeek != null ? (
              <ul className="history-hover-legend">
                {series.map((s) => {
                  const point = s.points.find((p) => p.week === legendWeek);
                  return (
                    <li key={s.teamId}>
                      <span className="history-swatch" style={{ background: s.color }} />
                      {s.name}
                      <strong>{point?.rank != null ? `#${point.rank}` : "NR"}</strong>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
