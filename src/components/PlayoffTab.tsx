"use client";

import { TeamChip } from "@/components/TeamChip";
import { buildPlayoffBracket, buildPlayoffField, playoffSummary } from "@/lib/playoff";
import { getTeam, recordLabel, REGIONS, tierName } from "@/lib/teams";
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
  const codes = new Map(field.map((entry) => [entry.seed, entry.rankCode]));
  const codeFor = (seed: number) => codes.get(seed) ?? String(seed);

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
        Labels are regional place, not a 1–24 seed: 1W is first in the West, 2E is the East
        runner-up, 6S is the South Tier III champion. Each region’s 1 and 2 receive a
        first-round bye. Opening games are always cross-region.
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
                      code={codeFor(game.seedA)}
                      label={game.labelA}
                      winnerId={game.projectedWinnerId}
                    />
                    <Slot
                      teamId={game.teamBId}
                      code={codeFor(game.seedB)}
                      label={game.labelB}
                      winnerId={game.projectedWinnerId}
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
          <span>1W is first in the West · 6 bids per region</span>
        </header>
        <div className="seed-grid">
          {REGIONS.map((region) => {
            const entries = field
              .filter((entry) => assignment[entry.teamId].region === region.id)
              .sort((a, b) => a.rankCode.localeCompare(b.rankCode, undefined, { numeric: true }));
            return (
              <section key={region.id} className="seed-region">
                <h3>{region.name}</h3>
                <ol>
                  {entries.map((entry) => {
                    const team = getTeam(entry.teamId);
                    const place = assignment[team.id];
                    return (
                      <li key={entry.teamId}>
                        <span className={`seed ${entry.bye ? "is-bye" : ""}`}>{entry.rankCode}</span>
                        <TeamChip
                          team={team}
                          extra={`${tierName(place.tier)}${entry.bye ? " · Bye" : ""}`}
                        />
                        <em className="bid">
                          {entry.bidLabel}
                          {" · "}
                          {recordLabel(team)}
                        </em>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Slot({
  teamId,
  code,
  label,
  winnerId,
}: {
  teamId: string | null;
  code: string;
  label: string;
  winnerId: string | null;
}) {
  const team = teamId ? getTeam(teamId) : null;
  const won = teamId !== null && teamId === winnerId;
  return (
    <div className={`slot ${won ? "is-winner" : ""}`}>
      <span className="slot-seed" aria-hidden="true">{code}</span>
      {team ? (
        <span className="slot-team">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={team.logo} alt="" width={18} height={18} />
          <span>{team.shortName}</span>
        </span>
      ) : (
        <span className="slot-team muted">{label}</span>
      )}
    </div>
  );
}
