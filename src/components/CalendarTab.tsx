"use client";

import { useState } from "react";
import { TeamChip } from "@/components/TeamChip";
import { gamesInWeek } from "@/lib/schedule";
import { REGIONS, SEASON_WEEKS, getTeam, regionName } from "@/lib/teams";
import type { Assignment, RegionId, RivalMap } from "@/lib/types";

export function CalendarTab({
  assignment,
  rivals,
}: {
  assignment: Assignment;
  rivals: RivalMap;
}) {
  const [week, setWeek] = useState(1);
  const [region, setRegion] = useState<RegionId | "all">("all");
  const games = gamesInWeek(assignment, rivals, week, region === "all" ? undefined : region);

  return (
    <div className="stack">
      <p className="lede">
        A 12-week regular season. Weeks 1–7 are the 8-team round-robins (every team in a
        complete tier plays every week). Protected leftovers and balanced crossovers fill
        weeks 8–12. Nobody plays twice in the same week.
      </p>
      <div className="week-bar">
        {Array.from({ length: SEASON_WEEKS }, (_, index) => index + 1).map((item) => (
          <button
            key={item}
            type="button"
            className={week === item ? "is-active" : ""}
            onClick={() => setWeek(item)}
          >
            {item}
          </button>
        ))}
        <select
          value={region}
          onChange={(event) => setRegion(event.target.value as RegionId | "all")}
          aria-label="Filter by region"
        >
          <option value="all">All regions</option>
          {REGIONS.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>
      <section className="panel">
        <header className="panel-head">
          <h2>Week {week}</h2>
          <span>{games.length} games</span>
        </header>
        <ul className="game-list">
          {games.map((game) => {
            const home = getTeam(game.homeId);
            const away = getTeam(game.awayId);
            return (
              <li key={game.id}>
                <TeamChip team={away} extra={regionName(assignment[away.id].region)} />
                <span className="muted">at</span>
                <TeamChip team={home} extra={regionName(assignment[home.id].region)} />
                <em className="bid">{game.label}</em>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
