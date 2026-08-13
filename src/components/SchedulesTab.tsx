"use client";

import { useMemo, useState } from "react";
import { TeamChip, TeamRow, useTeamSearch } from "@/components/TeamChip";
import { byeWeekOf, scheduleFor, scheduleStrength } from "@/lib/schedule";
import {
  LEAGUE_BYE_WEEK,
  REGIONS,
  SEASON_WEEKS,
  TEAMS,
  getTeam,
  recordLabel,
  regionName,
  tierName,
} from "@/lib/teams";
import type { Assignment, GameKind, RivalMap, ScheduledGame } from "@/lib/types";

const KIND_LABEL: Record<GameKind, string> = {
  rival: "Protected rival",
  "in-tier": "Same tier",
  "inter-region": "Crossover",
  "cross-tier": "Region, other tier",
};

type SlateRow =
  | { type: "game"; week: number; game: ScheduledGame }
  | { type: "bye"; week: number };

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
  const byeWeek = byeWeekOf(schedule.games);
  const slate: SlateRow[] = [];
  for (let week = 1; week <= SEASON_WEEKS; week += 1) {
    const game = schedule.games.find((item) => item.week === week);
    if (game) slate.push({ type: "game", week, game });
    else slate.push({ type: "bye", week });
  }

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
              2025 record {recordLabel(selected)} · {schedule.games.length}-game slate · bye
              week {byeWeek} · opponent win% {Math.round(sos * 1000) / 10}
            </p>
          </div>
        </header>
        <ul className="game-list">
          {slate.map((row) => {
            if (row.type === "bye") {
              return (
                <li key={`bye-${row.week}`} className="is-bye-week">
                  <span className="week-pill">W{row.week}</span>
                  <div className="chip-copy">
                    <b>Bye</b>
                    <span className="muted">
                      {row.week === LEAGUE_BYE_WEEK ? "League-wide off week" : "No game this week"}
                    </span>
                  </div>
                </li>
              );
            }
            const game = row.game;
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
          Weeks 1–5 are games outside the tier (leftover rivals, balanced crossovers, and
          same-region clubs from other tiers). Week 6 is a bye for every team. Weeks 7–13 are
          the 8-team round-robin. Still 12 games — the bye is not a 13th contest. Protected
          rivals are named series only (0–3); open slots fill in-region, out of tier.
        </p>
      </section>
    </div>
  );
}
