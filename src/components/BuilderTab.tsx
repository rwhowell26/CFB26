"use client";

import { useMemo, useState } from "react";
import { TeamChip, TeamRow, useTeamSearch } from "@/components/TeamChip";
import { tenYearFrequencies } from "@/lib/schedule";
import { rivalsOf, setRival } from "@/lib/rivals";
import { TEAMS, getTeam, recordLabel, regionName, tierName } from "@/lib/teams";
import type { Assignment, RivalMap } from "@/lib/types";

export function BuilderTab({
  assignment,
  rivals,
  onChangeRivals,
}: {
  assignment: Assignment;
  rivals: RivalMap;
  onChangeRivals: (next: RivalMap) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(TEAMS[0]?.id ?? "");
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [rivalQuery, setRivalQuery] = useState("");
  const filtered = useTeamSearch(
    [...TEAMS].sort((a, b) => a.shortName.localeCompare(b.shortName)),
    query,
  );
  const selected = getTeam(selectedId);
  const place = assignment[selectedId];
  const rivalIds = rivalsOf(rivals, selectedId);
  const rivalTeams = rivalIds.map(getTeam);
  const frequencies = useMemo(
    () => tenYearFrequencies(assignment, rivals, selectedId),
    [assignment, rivals, selectedId],
  );
  const rivalChoices = useTeamSearch(
    [...TEAMS]
      .filter((team) => team.id !== selectedId)
      .sort((a, b) => a.shortName.localeCompare(b.shortName)),
    rivalQuery,
  );

  return (
    <div className="split">
      <aside className="side-list">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search teams"
          aria-label="Search teams"
        />
        <div className="scroll">
          {filtered.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              active={team.id === selectedId}
              onClick={() => {
                setSelectedId(team.id);
                setEditingSlot(null);
              }}
            />
          ))}
        </div>
      </aside>
      <section className="panel">
        <header className="hero-team">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.logo} alt="" width={64} height={64} />
          <div>
            <p className="eyebrow">Schedule construction</p>
            <h2>{selected.shortName}</h2>
            <p>
              {regionName(place.region)} {tierName(place.tier)} · {recordLabel(selected)} last year
            </p>
          </div>
        </header>

        <h3 className="section-title">Protected rivals · every year</h3>
        <p className="footnote" style={{ marginTop: 0 }}>
          Click a rival to replace them. If that club is in the same 8-team tier, the game
          already counts toward the round-robin.
        </p>
        <div className="rival-row">
          {[0, 1, 2].map((slot) => {
            const rival = rivalTeams[slot];
            return (
              <button
                key={slot}
                type="button"
                className={`rival-card ${editingSlot === slot ? "is-editing" : ""}`}
                onClick={() => {
                  setEditingSlot(slot);
                  setRivalQuery("");
                }}
              >
                {rival ? (
                  <TeamChip
                    team={rival}
                    extra={`${regionName(assignment[rival.id].region)} ${tierName(assignment[rival.id].tier)}`}
                  />
                ) : (
                  <span>Empty slot — choose a rival</span>
                )}
              </button>
            );
          })}
        </div>
        {editingSlot !== null ? (
          <div className="rival-picker">
            <input
              value={rivalQuery}
              onChange={(event) => setRivalQuery(event.target.value)}
              placeholder="Replace with…"
              aria-label="Choose a new protected rival"
            />
            <div className="scroll picker-list">
              {rivalChoices.slice(0, 40).map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  onClick={() => {
                    onChangeRivals(setRival(rivals, selectedId, editingSlot, team.id));
                    setEditingSlot(null);
                  }}
                />
              ))}
            </div>
            <button type="button" className="ghost" onClick={() => setEditingSlot(null)}>
              Cancel
            </button>
          </div>
        ) : null}

        <h3 className="section-title">{regionName(place.region)} over 10 years</h3>
        <p className="footnote" style={{ marginTop: 0 }}>
          Same-tier clubs play every year (full round-robin). Protected rivals also play every
          year. Other clubs in the region only show up if they are a rival.
        </p>
        <table className="freq-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Tier</th>
              <th>2025</th>
              <th>Times / 10 yrs</th>
            </tr>
          </thead>
          <tbody>
            {frequencies.map((row) => {
              const opponent = getTeam(row.opponentId);
              const oppPlace = assignment[opponent.id];
              return (
                <tr key={row.opponentId} className={row.everyYear ? "is-rival" : ""}>
                  <td>
                    <TeamChip team={opponent} compact extra={row.everyYear ? "Every year" : undefined} />
                  </td>
                  <td>{tierName(oppPlace.tier)}</td>
                  <td>{recordLabel(opponent)}</td>
                  <td>
                    <b>{row.times}</b>
                    <span className="bar" style={{ width: `${row.times * 10}%` }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
