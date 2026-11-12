"use client";

import { useMemo, useState } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { shortCbbConference } from "@/lib/cbb-conferences";
import { buildEliminatorBoard, type EliminatorRow } from "@/lib/cbb-eliminator";
import { formatRank, formatRecord, overallAverage } from "@/lib/cbb-metrics";
import { FIELD_SIZE } from "@/lib/cbb-season";
import { teamFillColors } from "@/lib/team-colors";
import type { CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

type Props = {
  teams: CbbTeam[];
  metrics: Map<string, CbbTeamMetrics>;
  lockedIds: string[];
  eliminatedIds: string[];
  onChange: (next: { lockedIds: string[]; eliminatedIds: string[] }) => void;
};

function roleLabel(row: EliminatorRow): string {
  if (row.status === "eliminated") return "Out";
  if (row.role === "auto-bid") return "AQ";
  if (row.role === "at-large") return "AL";
  if (row.role === "conference-chase") return "If AQ";
  return "";
}

export function EliminatorTab({ teams, metrics, lockedIds, eliminatedIds, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const rows = useMemo(
    () => buildEliminatorBoard(teams, teamsById, metrics, lockedIds, eliminatedIds),
    [teams, teamsById, metrics, lockedIds, eliminatedIds],
  );
  const eliminatedTeams = useMemo(
    () =>
      rows
        .filter((row) => row.status === "eliminated")
        .flatMap((row) => {
          const team = teamsById.get(row.teamId);
          return team ? [team] : [];
        }),
    [rows, teamsById],
  );
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter((row) => {
        const team = teamsById.get(row.teamId);
        if (!team) return false;
        return `${team.name} ${team.shortName} ${team.abbreviation} ${team.conference}`.toLowerCase().includes(needle);
      })
    : rows;
  const selected = selectedId ? rows.find((row) => row.teamId === selectedId) : null;
  const selectedTeam = selectedId ? teamsById.get(selectedId) : null;

  const setStatus = (teamId: string, status: "locked" | "eliminated" | "open") => {
    const nextLocked = lockedIds.filter((id) => id !== teamId);
    const nextEliminated = eliminatedIds.filter((id) => id !== teamId);
    if (status === "locked") nextLocked.push(teamId);
    if (status === "eliminated") nextEliminated.push(teamId);
    onChange({ lockedIds: nextLocked, eliminatedIds: nextEliminated });
  };

  return (
    <div className="cbb-eliminator">
      <section className="panel cbb-results-bar">
        <header className="panel-header">
          <p className="eyebrow">Eliminator</p>
          <h2>Metrics field</h2>
          <p>
            {rows.filter((row) => row.inField).length}/{FIELD_SIZE} in · {lockedIds.length} locked ·{" "}
            {eliminatedIds.length} eliminated · seeds from the six-rank average, not your bracketology
          </p>
        </header>
        <div className="cbb-elim-toolbar">
          <input
            type="search"
            placeholder="Search teams or conferences"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {selected && selectedTeam ? (
            <div className="cbb-elim-actions">
              <span>
                {selectedTeam.shortName}
                {selected.seed != null ? ` · ${selected.seed}-seed` : ""}
                {selected.playIn ? " PI" : ""}
              </span>
              <button
                type="button"
                className="primary-btn"
                onClick={() => setStatus(selected.teamId, selected.status === "locked" ? "open" : "locked")}
              >
                {selected.status === "locked" ? "Unlock" : "Lock"}
              </button>
              <button
                type="button"
                className={selected.status === "eliminated" ? "primary-btn" : "ghost-btn"}
                onClick={() => setStatus(selected.teamId, selected.status === "eliminated" ? "open" : "eliminated")}
              >
                {selected.status === "eliminated" ? "Add back" : "Eliminate"}
              </button>
            </div>
          ) : (
            <p className="cbb-elim-hint">Click a team to lock them in or eliminate them.</p>
          )}
        </div>
        {eliminatedTeams.length ? (
          <div className="cbb-elim-out">
            <p>Eliminated · click to add back</p>
            <div className="cbb-elim-out-list">
              {eliminatedTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className="cbb-elim-out-chip"
                  onClick={() => setStatus(team.id, "open")}
                >
                  <TeamLogo team={team} />
                  {team.shortName}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <ol className="cbb-scurve cbb-elim-list">
        {visible.map((row) => {
          const team = teamsById.get(row.teamId);
          if (!team) return null;
          const lockedFill = row.status === "locked" ? teamFillColors(team.color, team.alternateColor, team.id) : undefined;
          return (
            <li key={row.teamId}>
              <button
                type="button"
                className={`cbb-scurve-row cbb-elim-row${row.role === "auto-bid" ? " auto" : row.role === "at-large" ? " at-large" : ""}${
                  row.role === "conference-chase" ? " chase" : ""
                }${row.playIn ? " play-in" : ""}${row.status === "locked" ? " is-locked" : ""}${
                  row.status === "eliminated" ? " is-eliminated" : ""
                }${selectedId === row.teamId ? " is-selected" : ""}`}
                style={lockedFill}
                onClick={() => setSelectedId(row.teamId)}
              >
                <span className="cbb-scurve-rank">{row.seed != null ? row.seed : "·"}</span>
                <span className="cbb-scurve-idx">#{row.rank}</span>
                <TeamLogo team={team} onFill={lockedFill?.backgroundColor} />
                <strong>
                  {team.shortName}
                  {row.playIn ? <span className="cbb-pi">PI</span> : null}
                  {row.status === "locked" ? <span className="cbb-elim-tag">Lock</span> : null}
                  {row.status === "eliminated" ? <span className="cbb-elim-tag out">Elim</span> : null}
                </strong>
                <span className="cbb-scurve-meta">{shortCbbConference(team.conference)}</span>
                <span className="cbb-scurve-meta">{formatRecord(team.wins, team.losses)}</span>
                <span className="cbb-scurve-avg">{formatRank(overallAverage(metrics.get(team.id)), 1)}</span>
                <span className="cbb-elim-role">{roleLabel(row)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
