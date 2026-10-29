"use client";

import { useMemo } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { playoffTableLabel, shortConferenceName } from "@/lib/conferences";
import {
  adjustConferenceRecord,
  applyConferenceGame,
  atLargeFieldTeams,
  atLargePoolTeams,
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
  pendingConferenceGames,
  pendingGamesForConference,
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
    () => (cfp.published ? autoBidTeams(teams, live, cfp) : []),
    [cfp, live, teams],
  );
  const autoBidIds = useMemo(() => new Set(autoBids.map((team) => team.id)), [autoBids]);
  const atLargeField = useMemo(
    () => (cfp.published ? atLargeFieldTeams(teams, live, cfp, autoBidIds) : []),
    [cfp, live, teams, autoBidIds],
  );
  const atLargePool = useMemo(
    () => atLargePoolTeams(teams, live, cfp),
    [teams, live, cfp],
  );
  const independents = useMemo(
    () => independentEliminated(teams, live),
    [teams, live],
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
        <ul className="playoff-swatches">
          {(["destiny", "alive", "out-loss", "eliminated"] as const).map((status) => (
            <li key={status} className={STATUS_CLASS[status]}>
              {PLAYOFF_STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
        <p className="playoff-cfp-note">
          {cfp.published
            ? `CFP ${cfp.weekLabel ?? `Week ${cfp.week ?? ""}`} · Auto Bid is the five highest-ranked remaining conference champions · At-Large is the next seven`
            : "CFP rankings are not out yet. Auto Bid and the 12-team field fill when ESPN publishes the committee 25."}
        </p>
      </section>

      {cfp.published ? (
        <ol className="playoff-cfp-strip">
          {cfp.ranks.map((row) => {
            const team = teamsById.get(row.teamId);
            if (!team) return null;
            return (
              <li key={row.teamId}>
                <span>#{row.rank}</span>
                <TeamLogo team={team} />
                <em>{team.shortName}</em>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="playoff-top">
        <section className="playoff-rail-card auto-bid">
          <header>
            <h3>Auto Bid</h3>
            <span>5 champs</span>
          </header>
          {cfp.published ? (
            <ol>
              {autoBids.length ? (
                autoBids.map((team, index) => (
                  <li key={team.id}>
                    <span className="playoff-slot">{index + 1}</span>
                    <TeamLogo team={team} />
                    <div>
                      <strong>{team.shortName}</strong>
                      <em>
                        #{ranks.get(team.id)} · {playoffTableLabel(team.conference)}
                      </em>
                    </div>
                  </li>
                ))
              ) : (
                <li className="playoff-empty">No ranked remaining conference champions yet.</li>
              )}
            </ol>
          ) : (
            <p className="playoff-empty">Waiting on the CFP 25.</p>
          )}
        </section>

        <section className="playoff-rail-card at-large">
          <header>
            <h3>At-Large</h3>
            <span>7 after auto bids</span>
          </header>
          {cfp.published ? (
            <ol>
              {atLargeField.length ? (
                atLargeField.map((team, index) => (
                  <li key={team.id}>
                    <span className="playoff-slot">{index + 1}</span>
                    <TeamLogo team={team} />
                    <div>
                      <strong>{team.shortName}</strong>
                      <em>
                        #{ranks.get(team.id)} · {shortConferenceName(team.conference)}
                      </em>
                    </div>
                  </li>
                ))
              ) : (
                <li className="playoff-empty">No at-large field until more teams are ranked.</li>
              )}
            </ol>
          ) : (
            <p className="playoff-empty">Waiting on the CFP 25.</p>
          )}

          {atLargePool.length ? (
            <ul className="playoff-pool">
              {atLargePool.map((team) => {
                const nd = isNotreDame(team);
                const rec = nd ? live.notreDameRecord : conferenceRecord(live, team.id);
                return (
                  <li key={team.id}>
                    <TeamLogo team={team} />
                    <div>
                      <strong>{team.shortName}</strong>
                      <em>
                        {ranks.has(team.id) ? `#${ranks.get(team.id)} · ` : ""}
                        {rec.wins}-{rec.losses}
                        {nd ? " overall" : ` ${shortConferenceName(team.conference)}`}
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
            </ul>
          ) : null}
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
}: {
  team: Team;
  state: PlayoffRaceState;
  games: Game[];
  cfpRank?: number;
  onCycle: () => void;
  onAdjust: (field: "wins" | "losses", delta: number) => void;
  onDateChange: (date: string) => void;
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
        <strong>
          {rec.wins}-{rec.losses}
          {accGames ? `\u00A0\u00A0${accGames}` : ""}
        </strong>
        {status === "eliminated" ? (
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
        ) : null}
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
      </span>
    </li>
  );
}
