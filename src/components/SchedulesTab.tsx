"use client";

import { useMemo, useState } from "react";
import { TeamChip, TeamRow, useTeamSearch } from "@/components/TeamChip";
import { byeWeekOf, scheduleFor, scheduleStrength } from "@/lib/schedule";
import { gameWinnerId } from "@/lib/simulate";
import {
  LEAGUE_BYE_WEEK,
  REGIONS,
  SEASON_WEEKS,
  TEAMS,
  getTeam,
  recordLabel,
  regionName,
  spPlusLabel,
  tierName,
  withRecord,
} from "@/lib/teams";
import { traditionalDate } from "@/lib/rivalries";
import type { Assignment, GameKind, RivalMap, ScheduledGame, SeasonSim } from "@/lib/types";

const KIND_LABEL: Record<GameKind, string> = {
  rival: "Protected rival",
  "in-tier": "Same tier",
  "inter-region": "Crossover",
  "cross-tier": "Other tier",
};

type SlateRow =
  | { type: "game"; week: number; game: ScheduledGame }
  | { type: "bye"; week: number };

export function SchedulesTab({
  assignment,
  rivals,
  season,
}: {
  assignment: Assignment;
  rivals: RivalMap;
  season: SeasonSim;
}) {
  const oleMiss = TEAMS.find((team) => team.abbreviation === "MISS");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(oleMiss?.id ?? TEAMS[0]?.id ?? "");
  const filtered = useTeamSearch(
    [...TEAMS].sort((a, b) => a.shortName.localeCompare(b.shortName)),
    query,
  );
  const selected = withRecord(getTeam(selectedId), season.records);
  const place = assignment[selectedId];
  const schedule = useMemo(
    () => scheduleFor(assignment, rivals, selectedId),
    [assignment, rivals, selectedId],
  );
  const sos = scheduleStrength(schedule.games, season.records);
  const byeWeek = byeWeekOf(schedule.games);
  const slate: SlateRow[] = [];
  for (let week = 1; week <= SEASON_WEEKS; week += 1) {
    const game = schedule.games.find((item) => item.week === week);
    if (game) slate.push({ type: "game", week, game });
    else slate.push({ type: "bye", week });
  }
  const left = slate.slice(0, 7);
  const right = slate.slice(7);

  return (
    <div className="split schedules-layout">
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
              team={withRecord(team, season.records)}
              active={team.id === selectedId}
              onClick={() => setSelectedId(team.id)}
            />
          ))}
        </div>
      </aside>
      <section className="panel schedule-panel">
        <header className="hero-team">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.logo} alt="" width={44} height={44} />
          <div>
            <p className="eyebrow">
              {regionName(place.region)} · {tierName(place.tier)} · {spPlusLabel(selected)}
            </p>
            <h2>{selected.name}</h2>
            <p>
              {recordLabel(selected)} in 2026 · 12 games · bye W{byeWeek} · opp win%{" "}
              {Math.round(sos * 1000) / 10}
            </p>
          </div>
        </header>
        <div className="schedule-slate">
          <WeekColumn
            rows={left}
            selectedId={selectedId}
            assignment={assignment}
            season={season}
          />
          <WeekColumn
            rows={right}
            selectedId={selectedId}
            assignment={assignment}
            season={season}
          />
        </div>
        <p className="footnote">
          W1–5 out of tier · W6 league bye · W7–13 round-robin. Named rivals only; dated
          series stay on their traditional Saturdays. Ole Miss wins every game; LSU loses
          every game; other results follow SP+.
        </p>
      </section>
    </div>
  );
}

function WeekColumn({
  rows,
  selectedId,
  assignment,
  season,
}: {
  rows: SlateRow[];
  selectedId: string;
  assignment: Assignment;
  season: SeasonSim;
}) {
  return (
    <ul className="game-list">
      {rows.map((row) => {
        if (row.type === "bye") {
          return (
            <li key={`bye-${row.week}`} className="is-bye-week">
              <span className="week-pill">W{row.week}</span>
              <div className="chip-copy">
                <b>Bye</b>
                <span className="muted">
                  {row.week === LEAGUE_BYE_WEEK ? "League-wide" : "Open"}
                </span>
              </div>
            </li>
          );
        }
        const game = row.game;
        const opponent = withRecord(getTeam(game.opponentId), season.records);
        const oppPlace = assignment[opponent.id];
        const series = traditionalDate(selectedId, game.opponentId)?.name;
        const winnerId = gameWinnerId(season, selectedId, game.opponentId);
        const won = winnerId === selectedId;
        return (
          <li key={`${game.week}-${game.opponentId}`} className={won ? "is-win" : "is-loss"}>
            <span className="week-pill">W{game.week}</span>
            <TeamChip
              team={opponent}
              compact
              extra={`${game.home ? "Home" : "Away"} · ${recordLabel(opponent)}`}
            />
            <div className="game-meta">
              <b>
                <span className={`result-pill ${won ? "is-win" : "is-loss"}`}>{won ? "W" : "L"}</span>
                {" "}
                {series ?? KIND_LABEL[game.kind]}
              </b>
              <span>
                {REGIONS.find((region) => region.id === oppPlace.region)?.name}{" "}
                {tierName(oppPlace.tier)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
