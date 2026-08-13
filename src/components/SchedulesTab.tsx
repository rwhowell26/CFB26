"use client";

import { useMemo, useState } from "react";
import { TeamChip, TeamRow, useTeamSearch } from "@/components/TeamChip";
import { scheduleFor, scheduleStrength } from "@/lib/schedule";
import { REGIONS, TEAMS, TIER_META, getTeam, recordLabel } from "@/lib/teams";
import type { Assignment, GameKind } from "@/lib/types";

const KIND_LABEL: Record<GameKind, string> = {
  rival: "Protected rival",
  "in-tier": "Same tier",
  "inter-region": "Other region",
};

export function SchedulesTab({ assignment }: { assignment: Assignment }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(TEAMS[0]?.id ?? "");
  const filtered = useTeamSearch(
    [...TEAMS].sort((a, b) => a.shortName.localeCompare(b.shortName)),
    query,
  );
  const selected = getTeam(selectedId);
  const place = assignment[selectedId];
  const schedule = useMemo(
    () => scheduleFor(assignment, selectedId, 0),
    [assignment, selectedId],
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
              {REGIONS.find((region) => region.id === place.region)?.name} · {TIER_META[place.tier].name}
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
              <li key={`${game.kind}-${game.opponentId}`}>
                <TeamChip team={opponent} extra={`${recordLabel(opponent)} · ${game.home ? "Home" : "Away"}`} />
                <div className="game-meta">
                  <b>{KIND_LABEL[game.kind]}</b>
                  <span>
                    {REGIONS.find((region) => region.id === oppPlace.region)?.name} {TIER_META[oppPlace.tier].name}
                    {game.kind === "inter-region" ? ` · ${game.label}` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="footnote">
          Each team plays 3 protected rivals, 6 other teams in its own region/tier, and one team
          from each of the other three regions. Those three visitors are matched by 2025 regional
          standing so #1 plays other #1s, #12 plays other #12s, and so on.
        </p>
      </section>
    </div>
  );
}