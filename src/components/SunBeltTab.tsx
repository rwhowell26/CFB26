"use client";

import { useEffect, useMemo, useState } from "react";
import { SEASON_YEAR } from "@/lib/season";
import {
  formatPct,
  formatWinLoss,
  groupGamesByWeek,
  projectSunBelt,
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

function shortLabel(team: Team | undefined, fallback: string): string {
  if (!team) return fallback.replace(/\s+University$/, "").replace(/^University of\s+/i, "");
  return team.abbreviation || team.shortName;
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
      <section className="panel sbc-top">
        <header className="panel-header sbc-top-header">
          <h2>{SEASON_YEAR} Sun Belt</h2>
          <p className="sbc-champ-line">
            <strong>CCG</strong> {nameOf(projected.championship.eastId)} vs{" "}
            {nameOf(projected.championship.westId)}
            <span> · {projected.championship.hostNote}</span>
            <span>
              {" "}
              ·{" "}
              {projected.unpickedCount > 0
                ? `${projected.unpickedCount} unpicked`
                : "all remaining games picked"}
            </span>
          </p>
        </header>
      </section>

      <div className="sbc-boards">
        <DivisionCard
          title="Projected East"
          table={projected.east}
          teamsById={teamsById}
          selectedTeamId={selectedTeamId}
          onSelectTeam={onSelectTeam}
        />
        <DivisionCard
          title="Projected West"
          table={projected.west}
          teamsById={teamsById}
          selectedTeamId={selectedTeamId}
          onSelectTeam={onSelectTeam}
        />
        <DivisionCard
          title="Current East"
          table={current.east}
          teamsById={teamsById}
          selectedTeamId={selectedTeamId}
          onSelectTeam={onSelectTeam}
          compact
        />
        <DivisionCard
          title="Current West"
          table={current.west}
          teamsById={teamsById}
          selectedTeamId={selectedTeamId}
          onSelectTeam={onSelectTeam}
          compact
        />
      </div>

      <section className="panel sbc-slate-panel">
        <header className="panel-header sbc-slate-header">
          <h2>Remaining conference games</h2>
          <div className="sbc-game-toolbar">
            <label>
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
              />
              Hide completed
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
        </header>
        {remainingWeeks.length === 0 ? (
          <p className="sbc-empty">No remaining Sun Belt conference games on the ESPN slate.</p>
        ) : (
          <div className="sbc-slate">
            {remainingWeeks.map((week) => (
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
            ))}
          </div>
        )}
        {!hideCompleted && completedWeeks.length > 0 ? (
          <div className="sbc-slate sbc-completed-slate">
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
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DivisionCard({
  title,
  table,
  teamsById,
  selectedTeamId,
  onSelectTeam,
  compact = false,
}: {
  title: string;
  table: DivisionTable;
  teamsById: Map<string, Team>;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string) => void;
  compact?: boolean;
}) {
  return (
    <section className={`panel sbc-division${compact ? " compact" : ""}`}>
      <header className="panel-header">
        <h2 title={table.champExplanation}>{title}</h2>
      </header>
      <div className="sbc-table-wrap">
        <table className="sbc-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col">Conf</th>
              {compact ? null : (
                <>
                  <th scope="col">Div</th>
                  <th scope="col">FBS</th>
                </>
              )}
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
                compact={compact}
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
  compact,
}: {
  row: RankedSunBeltRow;
  team: Team | undefined;
  selected: boolean;
  onSelectTeam?: (teamId: string) => void;
  compact: boolean;
}) {
  const name = compact
    ? shortLabel(team, row.teamId)
    : (team?.shortName ?? row.teamId);
  return (
    <tr className={`${row.champion ? "champ" : ""} ${selected ? "selected" : ""}`}>
      <td>{row.place}</td>
      <td>
        <button
          type="button"
          className="sbc-team-btn"
          title={row.tieNote ?? team?.name}
          onClick={() => onSelectTeam?.(row.teamId)}
        >
          {team?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt="" className="team-logo" />
          ) : null}
          <strong>{name}</strong>
        </button>
      </td>
      <td title={formatPct(row.conf)}>{formatWinLoss(row.conf)}</td>
      {compact ? null : (
        <>
          <td>{formatWinLoss(row.division)}</td>
          <td>{formatWinLoss(row.fbs)}</td>
        </>
      )}
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
      title={team?.shortName ?? fallbackName}
      onClick={() => onPick?.(teamId)}
    >
      {team?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" className="team-logo" />
      ) : null}
      <strong>{shortLabel(team, fallbackName)}</strong>
      {score != null ? <span className="sbc-score">{score}</span> : null}
    </button>
  );
}
