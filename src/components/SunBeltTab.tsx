"use client";

import { useEffect, useMemo, useState } from "react";
import { SEASON_YEAR } from "@/lib/season";
import {
  formatPct,
  formatWinLoss,
  groupGamesByWeek,
  projectSunBelt,
  winningPct,
  type DivisionTable,
  type RankedSunBeltRow,
} from "@/lib/sunbelt";
import type { Game, Team } from "@/lib/types";

const PICKS_KEY = `cfb26-sunbelt-picks-${SEASON_YEAR}`;

type Props = {
  teams: Team[];
  games: Game[];
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
};

function loadPicks(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PICKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function gameWinnerId(game: Game): string | null {
  if (game.status !== "final" || game.homeScore == null || game.awayScore == null) {
    return null;
  }
  if (game.homeScore === game.awayScore) return null;
  return game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
}

export function SunBeltTab({ teams, games, onSelectTeam, selectedTeamId }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [picksReady, setPicksReady] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(true);

  useEffect(() => {
    setPicks(loadPicks());
    setPicksReady(true);
  }, []);

  useEffect(() => {
    if (!picksReady) return;
    window.localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
  }, [picks, picksReady]);

  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const current = useMemo(() => projectSunBelt(teams, games), [teams, games]);
  const projected = useMemo(
    () => projectSunBelt(teams, games, { picks }),
    [teams, games, picks],
  );

  const currentRows = useMemo(() => {
    return [...current.east.rows, ...current.west.rows].sort((a, b) => {
      const ap = winningPct(a.conf) ?? -1;
      const bp = winningPct(b.conf) ?? -1;
      if (ap !== bp) return bp - ap;
      if (a.conf.wins !== b.conf.wins) return b.conf.wins - a.conf.wins;
      return (teamsById.get(a.teamId)?.shortName ?? a.teamId).localeCompare(
        teamsById.get(b.teamId)?.shortName ?? b.teamId,
      );
    });
  }, [current, teamsById]);

  const remainingWeeks = useMemo(
    () => groupGamesByWeek(projected.remainingConference),
    [projected.remainingConference],
  );
  const completedWeeks = useMemo(
    () => groupGamesByWeek(projected.completedConference),
    [projected.completedConference],
  );

  const setPick = (gameId: string, winnerId: string) => {
    setPicks((prev) => {
      const next = { ...prev };
      if (next[gameId] === winnerId) delete next[gameId];
      else next[gameId] = winnerId;
      return next;
    });
  };

  const nameOf = (id: string | null) =>
    id ? (teamsById.get(id)?.shortName ?? id) : "TBD";

  return (
    <div className="sbc-wrap">
      <section className="panel">
        <header className="panel-header">
          <h2>{SEASON_YEAR} Sun Belt standings</h2>
          <p>
            Pick remaining conference winners. Division titles use the official Sun Belt
            formula: conference winning percentage, then two-team or multi-team tiebreakers
            (head-to-head / games among the tied teams, division percentage, records down
            the standings, common cross-division opponents, CFP final-weekend result if
            published, overall FBS percentage, then a coin toss). Computer composites are
            skipped until those rankings are available.
          </p>
        </header>
        <div className="sbc-champ-banner">
          <div>
            <strong>Championship</strong>
            <span>
              {nameOf(projected.championship.eastId)} vs {nameOf(projected.championship.westId)}
            </span>
          </div>
          <p>{projected.championship.hostNote}</p>
          {projected.unpickedCount > 0 ? (
            <p className="sbc-pending">
              {projected.unpickedCount} remaining conference game
              {projected.unpickedCount === 1 ? "" : "s"} unpicked — standings include
              completed games plus your picks.
            </p>
          ) : (
            <p className="sbc-pending">All remaining conference games have a projected winner.</p>
          )}
        </div>
      </section>

      <div className="sbc-standings-grid">
        <DivisionCard
          table={projected.east}
          teamsById={teamsById}
          selectedTeamId={selectedTeamId}
          onSelectTeam={onSelectTeam}
        />
        <DivisionCard
          table={projected.west}
          teamsById={teamsById}
          selectedTeamId={selectedTeamId}
          onSelectTeam={onSelectTeam}
        />
      </div>

      <section className="panel">
        <header className="panel-header">
          <h2>Current conference records</h2>
          <p>Completed Sun Belt games only, before remaining-game picks.</p>
        </header>
        <ul className="sbc-current">
          {currentRows.map((row) => {
            const team = teamsById.get(row.teamId);
            return (
              <li key={row.teamId}>
                <button
                  type="button"
                  className={selectedTeamId === row.teamId ? "selected" : ""}
                  onClick={() => onSelectTeam?.(row.teamId)}
                >
                  {team?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logo} alt="" className="team-logo" />
                  ) : null}
                  <strong>{team?.shortName ?? row.teamId}</strong>
                  <em>{formatWinLoss(row.conf)}</em>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Remaining conference games</h2>
          <p>Home team listed first. Click a team to project the winner; click again to clear.</p>
        </header>
        <div className="sbc-game-toolbar">
          <label>
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            Hide completed games
          </label>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setPicks({})}
            disabled={Object.keys(picks).length === 0}
          >
            Clear picks
          </button>
        </div>
        {remainingWeeks.length === 0 ? (
          <p className="sbc-empty">No remaining Sun Belt conference games on the ESPN slate.</p>
        ) : (
          remainingWeeks.map((week) => (
            <div key={week.week} className="sbc-week">
              <h3>{week.label}</h3>
              <ul className="sbc-games">
                {week.games.map((game) => (
                  <ConferenceGameRow
                    key={game.id}
                    game={game}
                    pick={picks[game.id] ?? null}
                    teamsById={teamsById}
                    onPick={(winnerId) => setPick(game.id, winnerId)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
        {!hideCompleted && completedWeeks.length > 0 ? (
          <>
            <h3 className="sbc-completed-heading">Completed games</h3>
            {completedWeeks.map((week) => (
              <div key={`done-${week.week}`} className="sbc-week">
                <h3>{week.label}</h3>
                <ul className="sbc-games">
                  {week.games.map((game) => (
                    <ConferenceGameRow
                      key={game.id}
                      game={game}
                      pick={gameWinnerId(game)}
                      teamsById={teamsById}
                      locked
                    />
                  ))}
                </ul>
              </div>
            ))}
          </>
        ) : null}
      </section>
    </div>
  );
}

function DivisionCard({
  table,
  teamsById,
  selectedTeamId,
  onSelectTeam,
}: {
  table: DivisionTable;
  teamsById: Map<string, Team>;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string) => void;
}) {
  return (
    <section className="panel sbc-division">
      <header className="panel-header">
        <h2>{table.label}</h2>
        <p>{table.champExplanation}</p>
      </header>
      <div className="sbc-table-wrap">
        <table className="sbc-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col">Conf</th>
              <th scope="col">Div</th>
              <th scope="col">FBS</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <StandingsRow
                key={row.teamId}
                row={row}
                team={teamsById.get(row.teamId)}
                selected={selectedTeamId === row.teamId}
                onSelectTeam={onSelectTeam}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StandingsRow({
  row,
  team,
  selected,
  onSelectTeam,
}: {
  row: RankedSunBeltRow;
  team: Team | undefined;
  selected: boolean;
  onSelectTeam?: (teamId: string) => void;
}) {
  return (
    <tr className={`${row.champion ? "champ" : ""} ${selected ? "selected" : ""} ${row.unresolved ? "unresolved" : ""}`}>
      <td>{row.place}</td>
      <td>
        <button type="button" className="sbc-team-btn" onClick={() => onSelectTeam?.(row.teamId)}>
          {team?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt="" className="team-logo" />
          ) : null}
          <span>
            <strong>{team?.shortName ?? row.teamId}</strong>
            {row.tieNote ? <em title={row.tieNote}>{row.tieNote}</em> : null}
          </span>
        </button>
      </td>
      <td>
        {formatWinLoss(row.conf)}
        <small>{formatPct(row.conf)}</small>
      </td>
      <td>{formatWinLoss(row.division)}</td>
      <td>{formatWinLoss(row.fbs)}</td>
    </tr>
  );
}

function ConferenceGameRow({
  game,
  pick,
  teamsById,
  onPick,
  locked = false,
}: {
  game: Game;
  pick: string | null;
  teamsById: Map<string, Team>;
  onPick?: (winnerId: string) => void;
  locked?: boolean;
}) {
  const home = teamsById.get(game.homeTeamId);
  const away = teamsById.get(game.awayTeamId);
  return (
    <li className={`sbc-game ${locked ? "locked" : ""}`}>
      <SidePick
        team={home}
        teamId={game.homeTeamId}
        fallbackName={game.homeName}
        score={game.homeScore}
        selected={pick === game.homeTeamId}
        locked={locked}
        onPick={onPick}
      />
      <span className="sbc-game-at">vs</span>
      <SidePick
        team={away}
        teamId={game.awayTeamId}
        fallbackName={game.awayName}
        score={game.awayScore}
        selected={pick === game.awayTeamId}
        locked={locked}
        onPick={onPick}
      />
    </li>
  );
}

function SidePick({
  team,
  teamId,
  fallbackName,
  score,
  selected,
  locked,
  onPick,
}: {
  team: Team | undefined;
  teamId: string;
  fallbackName: string;
  score: number | null;
  selected: boolean;
  locked: boolean;
  onPick?: (winnerId: string) => void;
}) {
  return (
    <button
      type="button"
      className={`sbc-side ${selected ? "winner" : ""}`}
      disabled={locked}
      onClick={() => onPick?.(teamId)}
    >
      {team?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" className="team-logo" />
      ) : null}
      <strong>{team?.shortName ?? fallbackName.replace(/\s+University$/, "")}</strong>
      {score != null ? <span className="sbc-score">{score}</span> : null}
    </button>
  );
}
