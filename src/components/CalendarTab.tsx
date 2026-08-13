"use client";

import { useState } from "react";
import { TeamChip } from "@/components/TeamChip";
import { gamesInWeek } from "@/lib/schedule";
import { WEEK_TRADITION } from "@/lib/rivalries";
import { LEAGUE_BYE_WEEK, REGIONS, SEASON_WEEKS, getTeam, regionName } from "@/lib/teams";
import type { Assignment, RegionId, RivalMap, SeasonSim } from "@/lib/types";

export function CalendarTab({
  assignment,
  rivals,
  season,
}: {
  assignment: Assignment;
  rivals: RivalMap;
  season: SeasonSim;
}) {
  const [week, setWeek] = useState(1);
  const [region, setRegion] = useState<RegionId | "all">("all");
  const games = gamesInWeek(assignment, rivals, week, region === "all" ? undefined : region);

  return (
    <div className="stack">
      <p className="lede">
        A 13-week calendar with 12 games and a league-wide bye. Weeks 1–5 are mostly games
        outside the tier. Week 6 is off for every team. Weeks 7–13 are the round-robins,
        except dated rivalries stay on their traditional Saturdays (Egg Bowl on Thanksgiving
        week, Alabama–Tennessee on the Third Saturday in October, Red River, and the rest).
        Winners are the 2026 simulation: Ole Miss always, LSU never, otherwise higher SP+.
      </p>
      <div className="week-bar">
        {Array.from({ length: SEASON_WEEKS }, (_, index) => index + 1).map((item) => (
          <button
            key={item}
            type="button"
            className={week === item ? "is-active" : ""}
            onClick={() => setWeek(item)}
          >
            {item === LEAGUE_BYE_WEEK ? `${item} bye` : WEEK_TRADITION[item] ? `${item}*` : item}
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
          <h2>
            {week === LEAGUE_BYE_WEEK
              ? `Week ${week} · Bye`
              : WEEK_TRADITION[week]
                ? `Week ${week} · ${WEEK_TRADITION[week]}`
                : `Week ${week}`}
          </h2>
          <span>{week === LEAGUE_BYE_WEEK ? "every team off" : `${games.length} games`}</span>
        </header>
        {week === LEAGUE_BYE_WEEK && games.length === 0 ? (
          <p className="lede" style={{ margin: 0 }}>
            League-wide bye. Out-of-tier games are already done; round-robin play starts next week.
          </p>
        ) : (
          <ul className="game-list">
            {games.map((game) => {
              const home = getTeam(game.homeId);
              const away = getTeam(game.awayId);
              const winnerId = season.winners[game.id];
              return (
                <li key={game.id} className={winnerId ? "has-result" : undefined}>
                  <TeamChip
                    team={away}
                    extra={regionName(assignment[away.id].region)}
                    winner={winnerId === away.id}
                  />
                  <span className="muted">at</span>
                  <TeamChip
                    team={home}
                    extra={regionName(assignment[home.id].region)}
                    winner={winnerId === home.id}
                  />
                  <em className="bid">{game.label}</em>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
