"use client";

import { useMemo } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { playoffTableLabel, shortConferenceName } from "@/lib/conferences";
import {
  adjustConferenceRecord,
  applyConferenceGame,
  atLargePoolTeams,
  AUTO_BID_IN_COUNT,
  AUTO_BID_OUT_COUNT,
  autoBidTeams,
  cfpRankMap,
  conferenceGamesForTeam,
  conferenceRecord,
  cycleTeamStatus,
  eliminateFromAtLarge,
  emptyPlayoffRace,
  formatPlayoffLossDate,
  gameWinnerId,
  independentEliminated,
  isNotreDame,
  overallPlayoffRecord,
  pendingConferenceGames,
  pendingGamesForConference,
  playoffContentionCounts,
  playoffTables,
  PLAYOFF_STATUS_LABEL,
  restoreToAtLarge,
  setEliminatedOn,
  setNotreDameRecord,
  teamPlayoffStatus,
  undoLastAppliedGame,
} from "@/lib/playoff-race";
import { formatGameWeekShort } from "@/lib/season";
import type { CfpPoll, Game, PlayoffRaceState, PlayoffStatus, Team } from "@/lib/types";

type Props = {
  teams: Team[];
  games: Game[];
  cfp: CfpPoll;
  state: PlayoffRaceState | undefined;
  onChange: (next: PlayoffRaceState) => void;
};

const STATUS_CLASS: Record<PlayoffStatus, string> = {
  destiny: "destiny",
  alive: "alive",
  "out-loss": "out-loss",
  eliminated: "eliminated",
};

export function PlayoffRaceTab({ teams, games, cfp, state, onChange }: Props) {
  const live = state ?? emptyPlayoffRace();
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const ranks = useMemo(() => cfpRankMap(cfp), [cfp]);
  const pending = useMemo(() => pendingConferenceGames(games, live), [games, live]);
  const tables = useMemo(
    () => playoffTables(teams, live, cfp, games),
    [teams, live, cfp, games],
  );
  const autoBids = useMemo(
    () => autoBidTeams(teams, games, cfp),
    [cfp, games, teams],
  );
  const atLargePool = useMemo(
    () => atLargePoolTeams(teams, live, cfp, games),
    [teams, live, cfp, games],
  );
  const independents = useMemo(
    () => independentEliminated(teams, live, games),
    [teams, live, games],
  );
  const counts = useMemo(
    () => playoffContentionCounts(teams, live, games, cfp),
    [teams, live, games, cfp],
  );

  const patch = (next: PlayoffRaceState) => onChange(next);

  return (
    <div className="playoff-wrap">
      <section className="panel playoff-legend">
        <header className="panel-header">
          <h2>Playoff race</h2>
          <p>Click a team to cycle status. Hover a record to adjust W–L.</p>
          <button
            type="button"
            className="ghost-btn"
            disabled={!live.appliedGameIds.length}
            onClick={() => patch(undoLastAppliedGame(live, games))}
          >
            Undo last apply
          </button>
        </header>
        <ul className="playoff-counts">
          <li>
            <strong>{counts.conference}</strong>
            in conference
          </li>
          <li className="destiny">
            <strong>{counts.autoBid}</strong>
            auto bid
          </li>
          <li className="eliminated">
            <strong>{counts.eliminated}</strong>
            eliminated
          </li>
        </ul>
        <ul className="playoff-swatches">
          {(["alive", "destiny", "out-loss", "eliminated"] as const).map((status) => (
            <li key={status} className={STATUS_CLASS[status]}>
              {PLAYOFF_STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
        <p className="playoff-cfp-note">
          Auto Bid fills when a team wins its CCG. At-Large is anyone out of the CCG race
          with 3 or fewer overall losses — including Notre Dame. Eliminate anyone you
          judge out of the field.
        </p>
      </section>

      <div className="playoff-top">
        <section className="playoff-rail-card auto-bid">
          <header>
            <h3>Auto Bid</h3>
            <span>CCG winners</span>
          </header>
          {autoBids.length ? (
            <ol>
              {autoBids.map((team, index) => {
                const rec = overallPlayoffRecord(team, live, games);
                const bidClass =
                  index < AUTO_BID_IN_COUNT
                    ? "bid-in"
                    : index < AUTO_BID_IN_COUNT + AUTO_BID_OUT_COUNT
                      ? "bid-out"
                      : undefined;
                return (
                  <li key={team.id} className={bidClass}>
                    <span className="playoff-slot">{index + 1}</span>
                    <TeamLogo team={team} />
                    <div>
                      <strong>{team.shortName}</strong>
                      <em>
                        {ranks.has(team.id) ? `#${ranks.get(team.id)} · ` : ""}
                        {rec.wins}-{rec.losses} · {playoffTableLabel(team.conference)}
                      </em>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="playoff-empty">Empty until conference championship weekend.</p>
          )}
        </section>

        <section className="playoff-rail-card at-large">
          <header>
            <h3>At-Large</h3>
            <span>out of CCG · ≤3 losses</span>
          </header>
          {atLargePool.length ? (
            <ol className="playoff-pool">
              {atLargePool.map((team, index) => {
                const nd = isNotreDame(team);
                const rec = overallPlayoffRecord(team, live, games);
                return (
                  <li key={team.id}>
                    <span className="playoff-slot">{index + 1}</span>
                    <TeamLogo team={team} />
                    <div>
                      <strong>{team.shortName}</strong>
                      <em>
                        {ranks.has(team.id) ? `#${ranks.get(team.id)} · ` : ""}
                        {rec.wins}-{rec.losses} overall
                        {nd ? "" : ` · ${shortConferenceName(team.conference)}`}
                      </em>
                    </div>
                    {nd ? (
                      <span className="playoff-stepper">
                        <button
                          type="button"
                          onClick={() => patch(setNotreDameRecord(live, "wins", 1))}
                        >
                          W+
                        </button>
                        <button
                          type="button"
                          onClick={() => patch(setNotreDameRecord(live, "wins", -1))}
                        >
                          W−
                        </button>
                        <button
                          type="button"
                          onClick={() => patch(setNotreDameRecord(live, "losses", 1))}
                        >
                          L+
                        </button>
                        <button
                          type="button"
                          onClick={() => patch(setNotreDameRecord(live, "losses", -1))}
                        >
                          L−
                        </button>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => patch(eliminateFromAtLarge(live, team.id, games))}
                    >
                      Eliminate
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="playoff-empty">
              Empty until a team is out of the CCG race with 3 or fewer overall losses.
            </p>
          )}
        </section>
      </div>

      <div className="playoff-grid">
        {tables.map((table) => {
          const conferencePending = pendingGamesForConference(
            pending,
            table.conference,
            teamsById,
          );
          const nextGame = conferencePending[0];
          return (
            <section key={table.conference} className="playoff-table">
              <header>
                <h3>{table.label}</h3>
                <span>{table.gamesInSeason || "—"}</span>
              </header>
              {nextGame ? (
                <NextConferenceGame
                  game={nextGame}
                  remaining={conferencePending.length}
                  teamsById={teamsById}
                  onApply={() => patch(applyConferenceGame(live, nextGame))}
                />
              ) : null}
              <ol>
                {table.standing.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    state={live}
                    games={games}
                    cfpRank={ranks.get(team.id)}
                    onCycle={() => patch(cycleTeamStatus(live, team, games))}
                    onAdjust={(field, delta) =>
                      patch(adjustConferenceRecord(live, team.id, field, delta))
                    }
                    onDateChange={(date) => patch(setEliminatedOn(live, team.id, date))}
                  />
                ))}
              </ol>
              {table.eliminated.length ? (
                <div className="playoff-elim-block">
                  <h4>Eliminated</h4>
                  <ol>
                    {table.eliminated.map((team) => (
                      <TeamRow
                        key={team.id}
                        team={team}
                        state={live}
                        games={games}
                        cfpRank={ranks.get(team.id)}
                        onCycle={() => patch(cycleTeamStatus(live, team, games))}
                        onAdjust={(field, delta) =>
                          patch(adjustConferenceRecord(live, team.id, field, delta))
                        }
                        onDateChange={(date) => patch(setEliminatedOn(live, team.id, date))}
                        onRestore={
                          live.playoffEliminatedIds.includes(team.id)
                            ? () => patch(restoreToAtLarge(live, team.id))
                            : undefined
                        }
                      />
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>
          );
        })}
        <section className="playoff-table playoff-independents">
          <header>
            <h3>Independents</h3>
          </header>
          <ol>
            {independents.map((team) => (
              <li key={team.id} className="playoff-row eliminated">
                <button type="button" className="playoff-row-main" disabled>
                  <TeamLogo team={team} />
                  <span className="playoff-row-name">{team.shortName}</span>
                </button>
                <span className="playoff-wl">
                  {isNotreDame(team) ? (
                    <strong>
                      {live.notreDameRecord.wins}-{live.notreDameRecord.losses}
                    </strong>
                  ) : null}
                  {isNotreDame(team) ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => patch(restoreToAtLarge(live, team.id))}
                    >
                      Restore
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function NextConferenceGame({
  game,
  remaining,
  teamsById,
  onApply,
}: {
  game: Game;
  remaining: number;
  teamsById: Map<string, Team>;
  onApply: () => void;
}) {
  const winnerId = gameWinnerId(game);
  const homeWon = winnerId === game.homeTeamId;
  const away = teamsById.get(game.awayTeamId);
  const home = teamsById.get(game.homeTeamId);
  const awayLabel = away?.abbreviation || game.awayName;
  const homeLabel = home?.abbreviation || game.homeName;
  return (
    <div className="playoff-next-game">
      <span className="playoff-queue-week">{formatGameWeekShort(game.week)}</span>
      <span className={homeWon ? "playoff-loser" : "playoff-winner"}>
        {awayLabel} {game.awayScore}
      </span>
      <span className="playoff-queue-at">@</span>
      <span className={homeWon ? "playoff-winner" : "playoff-loser"}>
        {homeLabel} {game.homeScore}
      </span>
      <button type="button" className="primary-btn" disabled={!winnerId} onClick={onApply}>
        Apply
      </button>
      {remaining > 1 ? <em>+{remaining - 1}</em> : null}
    </div>
  );
}

function TeamRow({
  team,
  state,
  games,
  cfpRank,
  onCycle,
  onAdjust,
  onDateChange,
  onRestore,
}: {
  team: Team;
  state: PlayoffRaceState;
  games: Game[];
  cfpRank?: number;
  onCycle: () => void;
  onAdjust: (field: "wins" | "losses", delta: number) => void;
  onDateChange: (date: string) => void;
  onRestore?: () => void;
}) {
  const rec = conferenceRecord(state, team.id);
  const status = teamPlayoffStatus(state, team);
  const accGames =
    playoffTableLabel(team.conference) === "ACC"
      ? conferenceGamesForTeam(games, team.id)
      : 0;
  const elimDate = status === "eliminated" ? state.eliminatedOn?.[team.id] : undefined;
  return (
    <li className={`playoff-row ${STATUS_CLASS[status]}`}>
      <button type="button" className="playoff-row-main" onClick={onCycle}>
        <TeamLogo team={team} />
        <span className="playoff-row-name">{team.shortName}</span>
        {cfpRank != null ? <span className="playoff-cfp-tag">CFP {cfpRank}</span> : null}
      </button>
      <span className="playoff-wl">
        {status === "eliminated" ? (
          <>
            <label className="playoff-elim-date">
              <span>{elimDate ? formatPlayoffLossDate(elimDate) : "date"}</span>
              <input
                type="date"
                value={elimDate ?? ""}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onDateChange(event.target.value)}
                aria-label={`${team.shortName} eliminated date`}
              />
            </label>
            {onRestore ? (
              <button type="button" className="ghost-btn" onClick={onRestore}>
                Restore
              </button>
            ) : null}
          </>
        ) : (
          <>
            <strong>
              {rec.wins}-{rec.losses}
              {accGames ? `\u00A0\u00A0${accGames}` : ""}
            </strong>
            <span className="playoff-stepper">
              <button type="button" onClick={() => onAdjust("wins", 1)}>
                W+
              </button>
              <button type="button" onClick={() => onAdjust("wins", -1)}>
                W−
              </button>
              <button type="button" onClick={() => onAdjust("losses", 1)}>
                L+
              </button>
              <button type="button" onClick={() => onAdjust("losses", -1)}>
                L−
              </button>
            </span>
          </>
        )}
      </span>
    </li>
  );
}
