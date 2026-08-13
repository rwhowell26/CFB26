"use client";

import { useMemo, useState } from "react";
import { TeamChip, TeamRow, useTeamSearch } from "@/components/TeamChip";
import { tenYearFrequencies } from "@/lib/schedule";
import { realRivalIds } from "@/lib/rivalries";
import { rivalsOf, setRival, clearRival } from "@/lib/rivals";
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
  const knownRivalIds = realRivalIds(selectedId);
  const rivalChoices = useTeamSearch(
    knownRivalIds
      .map(getTeam)
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

        <h3 className="section-title">Protected rivals · 0 to 3</h3>
        <p className="footnote" style={{ marginTop: 0 }}>
          Only named college football rivalries can occupy these slots (max 3). Click to add
          or replace from that list, or clear a slot. A rival in the same 8-team tier already
          counts toward the round-robin. Open slots fill with other clubs in this region,
          not the same tier.
        </p>
        <div className="rival-row">
          {[0, 1, 2].map((slot) => {
            const rival = rivalTeams[slot];
            return (
              <div key={slot} className="rival-card-wrap">
                <button
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
                    <span>Open slot — not required</span>
                  )}
                </button>
                {rival ? (
                  <button
                    type="button"
                    className="rival-clear"
                    aria-label={`Remove ${rival.shortName} as a protected rival`}
                    onClick={() => {
                      onChangeRivals(clearRival(rivals, selectedId, slot));
                      setEditingSlot(null);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        {editingSlot !== null ? (
          <div className="rival-picker">
            <input
              value={rivalQuery}
              onChange={(event) => setRivalQuery(event.target.value)}
              placeholder="Search named rivalries"
              aria-label="Choose a new protected rival"
            />
            <div className="scroll picker-list">
              {rivalChoices.length ? (
                rivalChoices.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    onClick={() => {
                      onChangeRivals(setRival(rivals, selectedId, editingSlot, team.id));
                      setEditingSlot(null);
                    }}
                  />
                ))
              ) : (
                <p className="footnote" style={{ margin: 0 }}>
                  No named rivalry in this pool for this club.
                </p>
              )}
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                onChangeRivals(clearRival(rivals, selectedId, editingSlot));
                setEditingSlot(null);
              }}
            >
              Clear this slot
            </button>
            <button type="button" className="ghost" onClick={() => setEditingSlot(null)}>
              Cancel
            </button>
          </div>
        ) : null}

        <h3 className="section-title">{regionName(place.region)} over 10 years</h3>
        <p className="footnote" style={{ marginTop: 0 }}>
          Same-tier clubs play every year (full round-robin). Protected rivals also play every
          year. Remaining games against other clubs in the region (different tier) fill out
          the 12-game slate.
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
