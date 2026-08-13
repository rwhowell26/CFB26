"use client";

import { TeamChip } from "@/components/TeamChip";
import { buildPlayoffBracket, buildPlayoffField, playoffSummary } from "@/lib/playoff";
import { getTeam, recordLabel, regionName, tierName } from "@/lib/teams";
import type { Assignment, PlayoffGame } from "@/lib/types";

type Side = "left" | "right" | "center";

function half(games: PlayoffGame[], side: Exclude<Side, "center">) {
  const mid = Math.floor(games.length / 2);
  return side === "left" ? games.slice(0, mid) : games.slice(mid);
}

export function PlayoffTab({ assignment }: { assignment: Assignment }) {
  const field = buildPlayoffField(assignment);
  const bracket = buildPlayoffBracket(field);
  const summary = playoffSummary(field);

  const byRound = (round: PlayoffGame["round"]) =>
    bracket.filter((game) => game.round === round);

  const columns: Array<{
    key: string;
    title: string;
    games: PlayoffGame[];
    className: string;
  }> = [
    { key: "l-first", title: "First round", games: half(byRound("first"), "left"), className: "is-first is-left" },
    { key: "l-r16", title: "Round of 16", games: half(byRound("second"), "left"), className: "is-second is-left" },
    { key: "l-qf", title: "Quarters", games: half(byRound("quarter"), "left"), className: "is-quarter is-left" },
    { key: "l-sf", title: "Semis", games: half(byRound("semi"), "left"), className: "is-semi is-left" },
    { key: "final", title: "Championship", games: byRound("final"), className: "is-final" },
    { key: "r-sf", title: "Semis", games: half(byRound("semi"), "right"), className: "is-semi is-right" },
    { key: "r-qf", title: "Quarters", games: half(byRound("quarter"), "right"), className: "is-quarter is-right" },
    { key: "r-r16", title: "Round of 16", games: half(byRound("second"), "right"), className: "is-second is-right" },
    { key: "r-first", title: "First round", games: half(byRound("first"), "right"), className: "is-first is-right" },
  ];

  return (
    <div className="stack playoff-page">
      <p className="lede">
        Each region sends 3 from Tier I, 2 from Tier II, and 1 from Tier III (24 autobids).
        Seeds follow place and tier — not 2025 record. Opening games are always
        cross-region. Seeds 1–8 receive a first-round bye. The board is 1 vs 8,
        4 vs 5, 2 vs 7, and 3 vs 6 from the round of 16 on.
      </p>
      <div className="stat-row">
        <div className="stat"><b>{summary.fieldSize}</b><span>team field</span></div>
        <div className="stat"><b>{summary.autobids}</b><span>autobids</span></div>
        <div className="stat"><b>{summary.atLarge}</b><span>at-large</span></div>
        <div className="stat"><b>{summary.byes}</b><span>first-round byes</span></div>
      </div>

      <section className="panel playoff-board-panel">
        <header className="panel-head">
          <h2>Bracket</h2>
          <span>Projected winners still use 2025 win%</span>
        </header>
        <div className="bracket-board">
          {columns.map((column) => (
            <div key={column.key} className={`bracket-col ${column.className}`}>
              <h3>{column.title}</h3>
              <div className="bracket-col-games">
                {column.games.map((game) => (
                  <article key={game.id} className="bracket-game">
                    <Slot
                      teamId={game.teamAId}
                      seed={game.seedA}
                      label={game.labelA}
                      winnerId={game.projectedWinnerId}
                      assignment={assignment}
                    />
                    <Slot
                      teamId={game.teamBId}
                      seed={game.seedB}
                      label={game.labelB}
                      winnerId={game.projectedWinnerId}
                      assignment={assignment}
                    />
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Autobids</h2>
          <span>Seeded by tier and place</span>
        </header>
        <ol className="seed-grid">
          {field.map((entry) => {
            const team = getTeam(entry.teamId);
            const place = assignment[team.id];
            return (
              <li key={entry.teamId}>
                <span className={`seed ${entry.bye ? "is-bye" : ""}`}>{entry.seed}</span>
                <TeamChip
                  team={team}
                  extra={`${regionName(place.region)} ${tierName(place.tier)}`}
                />
                <em className="bid">
                  {entry.bye ? "Bye · " : ""}
                  {entry.bidLabel}
                  {" · "}
                  {recordLabel(team)}
                </em>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Slot({
  teamId,
  seed,
  label,
  winnerId,
  assignment,
}: {
  teamId: string | null;
  seed: number;
  label: string;
  winnerId: string | null;
  assignment: Assignment;
}) {
  const team = teamId ? getTeam(teamId) : null;
  const won = teamId !== null && teamId === winnerId;
  const place = team ? assignment[team.id] : null;
  return (
    <div className={`slot ${won ? "is-winner" : ""}`}>
      <span className="slot-seed">{seed}</span>
      {team ? (
        <span className="slot-team">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={team.logo} alt="" width={18} height={18} />
          <span>
            {team.shortName}
            {place ? <em>{regionName(place.region)}</em> : null}
          </span>
        </span>
      ) : (
        <span className="slot-team muted">{label}</span>
      )}
    </div>
  );
}
