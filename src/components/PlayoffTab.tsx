"use client";

import { TeamChip } from "@/components/TeamChip";
import { buildPlayoffBracket, buildPlayoffField, playoffSummary } from "@/lib/playoff";
import { REGIONS, TIER_META, getTeam, recordLabel } from "@/lib/teams";
import type { Assignment, PlayoffGame } from "@/lib/types";

const ROUNDS: PlayoffGame["round"][] = ["first", "second", "quarter", "semi", "final"];

export function PlayoffTab({ assignment }: { assignment: Assignment }) {
  const field = buildPlayoffField(assignment);
  const bracket = buildPlayoffBracket(field);
  const summary = playoffSummary(field);

  return (
    <div className="stack">
      <p className="lede">
        A 24-team playoff with a path from every tier. Each of the 12 region-tiers gets an
        autobid for its champion. Each Tier I group also locks in its runner-up, so the top
        band gets eight automatic berths to the lower tiers&apos; four. The last eight spots are
        at-large. Seeds 1–8 sit out the first round.
      </p>
      <div className="stat-row">
        <div className="stat"><b>{summary.fieldSize}</b><span>team field</span></div>
        <div className="stat"><b>{summary.autobids}</b><span>autobids</span></div>
        <div className="stat"><b>{summary.atLarge}</b><span>at-large</span></div>
        <div className="stat"><b>{summary.byes}</b><span>first-round byes</span></div>
      </div>

      <div className="split playoff-split">
        <section className="panel">
          <header className="panel-head">
            <h2>Field</h2>
            <span>Projected from 2025 records</span>
          </header>
          <ol className="seed-list">
            {field.map((entry) => {
              const team = getTeam(entry.teamId);
              const place = assignment[team.id];
              return (
                <li key={entry.teamId}>
                  <span className={`seed ${entry.bye ? "is-bye" : ""}`}>{entry.seed}</span>
                  <TeamChip
                    team={team}
                    extra={`${recordLabel(team)} · ${REGIONS.find((region) => region.id === place.region)?.name} ${TIER_META[place.tier].short}`}
                  />
                  <em className={`bid bid-${entry.bid}`}>
                    {entry.bye ? "Bye · " : ""}
                    {entry.bidLabel}
                  </em>
                </li>
              );
            })}
          </ol>
        </section>
        <section className="panel">
          <header className="panel-head">
            <h2>Bracket</h2>
            <span>Higher 2025 win% is treated as the projected winner</span>
          </header>
          <div className="bracket">
            {ROUNDS.map((round) => {
              const games = bracket.filter((game) => game.round === round);
              return (
                <div key={round} className="bracket-round">
                  <h3>{games[0]?.roundLabel}</h3>
                  {games.map((game) => (
                    <article key={game.id} className="bracket-game">
                      <Slot teamId={game.teamAId} seed={game.seedA} label={game.labelA} winnerId={game.projectedWinnerId} />
                      <Slot teamId={game.teamBId} seed={game.seedB} label={game.labelB} winnerId={game.projectedWinnerId} />
                    </article>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Slot({
  teamId,
  seed,
  label,
  winnerId,
}: {
  teamId: string | null;
  seed: number;
  label: string;
  winnerId: string | null;
}) {
  const team = teamId ? getTeam(teamId) : null;
  const won = teamId !== null && teamId === winnerId;
  return (
    <div className={`slot ${won ? "is-winner" : ""}`}>
      <span className="slot-seed">{seed}</span>
      {team ? (
        <span className="slot-team">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={team.logo} alt="" width={18} height={18} />
          {team.shortName}
        </span>
      ) : (
        <span className="slot-team muted">{label}</span>
      )}
    </div>
  );
}
