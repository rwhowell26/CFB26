"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  if (row.role === "auto-bid") return "AQ";
  if (row.role === "at-large") return "AL";
  if (row.role === "conference-chase") return "If AQ";
  return "";
}

function teamMatches(team: CbbTeam, needle: string): boolean {
  if (!needle) return true;
  return `${team.name} ${team.shortName} ${team.abbreviation} ${team.conference}`.toLowerCase().includes(needle);
}

export function EliminatorTab({ teams, metrics, lockedIds, eliminatedIds, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const rows = useMemo(
    () => buildEliminatorBoard(teams, teamsById, metrics, lockedIds, eliminatedIds),
    [teams, teamsById, metrics, lockedIds, eliminatedIds],
  );
  const listed = useMemo(() => rows.filter((row) => row.status !== "eliminated"), [rows]);
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
  const visible = needle ? listed.filter((row) => {
    const team = teamsById.get(row.teamId);
    return team ? teamMatches(team, needle) : false;
  }) : listed;
  const selected = selectedId ? listed.find((row) => row.teamId === selectedId) : null;
  const selectedTeam = selected ? teamsById.get(selected.teamId) ?? null : null;

  const closeRestore = useCallback(() => setRestoreOpen(false), []);

  const setStatus = (teamId: string, status: "locked" | "eliminated" | "open") => {
    const nextLocked = lockedIds.filter((id) => id !== teamId);
    const nextEliminated = eliminatedIds.filter((id) => id !== teamId);
    if (status === "locked") nextLocked.push(teamId);
    if (status === "eliminated") nextEliminated.push(teamId);
    if (status === "eliminated" && selectedId === teamId) setSelectedId(null);
    onChange({ lockedIds: nextLocked, eliminatedIds: nextEliminated });
  };

  const addBackButton = (
    <button
      type="button"
      className="ghost-btn"
      onClick={() => setRestoreOpen(true)}
      disabled={!eliminatedTeams.length}
      aria-haspopup="dialog"
      aria-expanded={restoreOpen}
    >
      Add back{eliminatedTeams.length ? ` (${eliminatedTeams.length})` : ""}
    </button>
  );

  return (
    <div className="cbb-eliminator has-dock">
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
          {addBackButton}
        </div>
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
                  selectedId === row.teamId ? " is-selected" : ""
                }`}
                style={lockedFill}
                onClick={() => setSelectedId(row.teamId)}
              >
                <span className="cbb-scurve-rank">{row.seed != null ? row.seed : "·"}</span>
                <span className="cbb-scurve-idx">#{row.rank}</span>
                <span className="cbb-elim-logo">
                  <TeamLogo team={team} onFill={lockedFill?.backgroundColor} />
                </span>
                <strong>
                  {team.shortName}
                  {row.playIn ? <span className="cbb-pi">PI</span> : null}
                  {row.status === "locked" ? <span className="cbb-elim-tag">Lock</span> : null}
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

      <div className="cbb-elim-dock" role="region" aria-label="Eliminator actions">
        {selected && selectedTeam ? (
          <>
            <TeamLogo team={selectedTeam} />
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
              className="ghost-btn"
              onClick={() => setStatus(selected.teamId, "eliminated")}
            >
              Eliminate
            </button>
          </>
        ) : (
          <p className="cbb-elim-hint">Click a team to lock or eliminate.</p>
        )}
        {addBackButton}
      </div>

      {restoreOpen ? (
        <RestoreDialog
          teams={eliminatedTeams}
          onRestore={(teamId) => {
            setStatus(teamId, "open");
            if (eliminatedTeams.length <= 1) closeRestore();
          }}
          onClose={closeRestore}
        />
      ) : null}
    </div>
  );
}

function RestoreDialog({
  teams,
  onRestore,
  onClose,
}: {
  teams: CbbTeam[];
  onRestore: (teamId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const needle = query.trim().toLowerCase();
  const matches = needle ? teams.filter((team) => teamMatches(team, needle)) : teams;

  useEffect(() => {
    searchRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card cbb-elim-restore"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cbb-elim-restore-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Eliminator</p>
            <h2 id="cbb-elim-restore-title">Add back eliminated teams</h2>
            <p>{teams.length} out of the field</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <input
          ref={searchRef}
          type="search"
          placeholder="Search eliminated teams"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {matches.length ? (
          <ul className="cbb-elim-restore-list">
            {matches.map((team) => (
              <li key={team.id}>
                <span>
                  <TeamLogo team={team} />
                  <strong>{team.shortName}</strong>
                  <em>{shortCbbConference(team.conference)}</em>
                </span>
                <button type="button" className="primary-btn" onClick={() => onRestore(team.id)}>
                  Add back
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cbb-elim-hint">{teams.length ? "No matching teams." : "No eliminated teams."}</p>
        )}
      </div>
    </div>
  );
}
