"use client";

import { useMemo, useState } from "react";
import { TeamChip, TeamRow, useTeamSearch } from "@/components/TeamChip";
import { tenYearFrequencies } from "@/lib/schedule";
import { REGIONS, TEAMS, TIER_META, getTeam, recordLabel } from "@/lib/teams";
import type { Assignment } from "@/lib/types";

export function BuilderTab({ assignment }: { assignment: Assignment }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(TEAMS[0]?.id ?? "");
  const filtered = useTeamSearch(
    [...TEAMS].sort((a, b) => a.shortName.localeCompare(b.shortName)),
    query,
  );
  const selected = getTeam(selectedId);
  const place = assignment[selectedId];
  const rivals = selected.rivals.map(getTeam);
  const frequencies = useMemo(
    () => tenYearFrequencies(assignment, selectedId),
    [assignment, selectedId],
  );
  const regionName = REGIONS.find((region) => region.id === place.region)?.name;

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
              onClick={() => setSelectedId(team.id)}
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
              {regionName} {TIER_META[place.tier].name} · {recordLabel(selected)} last year
            </p>
          </div>
        </header>

        <h3 className="section-title">Protected rivals · every year</h3>
        <div className="rival-row">
          {rivals.map((rival) => {
            const rivalPlace = assignment[rival.id];
            return (
              <div key={rival.id} className="rival-card">
                <TeamChip
                  team={rival}
                  extra={`${REGIONS.find((region) => region.id === rivalPlace.region)?.name} ${TIER_META[rivalPlace.tier].short}`}
                />
              </div>
            );
          })}
        </div>

        <h3 className="section-title">
          {regionName} rotation · next 10 years
        </h3>
        <p className="footnote" style={{ marginTop: 0 }}>
          Protected rivals show 10/10. Other same-tier teams rotate so each club plays six
          in-tier games per season. Cross-tier clubs in the same region only appear if they are
          a protected rival.
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
                    <TeamChip team={opponent} compact extra={row.everyYear ? "Rival" : undefined} />
                  </td>
                  <td>{TIER_META[oppPlace.tier].name}</td>
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