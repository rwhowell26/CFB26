"use client";

import { useMemo, useState } from "react";
import { TeamChip, TeamRow, useTeamSearch } from "@/components/TeamChip";
import { scheduleFor, scheduleStrength } from "@/lib/schedule";
import { REGIONS, TEAMS, getTeam, recordLabel, regionName, tierName } from "@/lib/teams";
import type { Assignment, GameKind, RivalMap } from "@/lib/types";

const KIND_LABEL: Record<GameKind, string> = {
  rival: "Protected rival",
  "in-tier": "Same tier",
  "inter-region": "Crossover",
};

export function SchedulesTab({
  assignment,
  rivals,
}: {
  assignment: Assignment;
  rivals: RivalMap;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(TEAMS[0]?.id ?? "");
  const filtered = useTeamSearch(
    [...TEAMS].sort((a, b) => a.shortName.localeCompare(b.shortName)),
    query,
  );
  const selected = getTeam(selectedId);
  const place = assignment[selectedId];
  const schedule = useMemo(
    () => scheduleFor(assignment, rivals, selectedId),
    [assignment, rivals, selectedId],
  );
  const sos = scheduleStrength(schedule.games);

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
      <section className="panel schedule-panel">
        <header className="hero-team">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.logo} alt="" width={64} height={64} />
          <div>
            <p className="eyebrow">
              {regionName(place.region)} · {tierName(place.tier)}
            </p>
            <h2>{selected.name}</h2>
            <p>
              2025 record {recordLabel(selected)} · {schedule.games.length}-game slate ·
              opponent win% {Math.round(sos * 1000) / 10}
            </p>
          </div>
        </header>
        <ul className="game-list">
          {schedule.games.map((game) => {
            const opponent = getTeam(game.opponentId);
            const oppPlace = assignment[opponent.id];
            return (
              <li key={`${game.week}-${game.opponentId}`}>
                <span className="week-pill">W{game.week}</span>
                <TeamChip team={opponent} extra={`${recordLabel(opponent)} · ${game.home ? "Home" : "Away"}`} />
                <div className="game-meta">
                  <b>{KIND_LABEL[game.kind]}</b>
                  <span>
                    {REGIONS.find((region) => region.id === oppPlace.region)?.name} {tierName(oppPlace.tier)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="footnote">
          Full round-robin inside the 8-team tier (rivals in that group count toward it), then
          leftover protected rivals, then one balanced crossover from each other region. Cap is
          12 weeks / 12 games — no 13th game.
        </p>
      </section>
    </div>
  );
}
