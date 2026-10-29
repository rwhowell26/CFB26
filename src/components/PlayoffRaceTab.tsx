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
  gameWinnerId,
  groupPendingGames,
  independentEliminated,
  isNotreDame,
  pendingConferenceGames,
  playoffTables,
  PLAYOFF_STATUS_LABEL,
  restoreToAtLarge,
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
  const pendingGroups = useMemo(
    () => groupPendingGames(pending, teamsById),
    [pending, teamsById],
  );
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
          <p>
            Conference records stay manual. Apply finals from the queue. Status is yours to
            mark — click a team to cycle. Independent of your personal ballot.
          </p>
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

      {pendingGroups.length ? (
        <section className="panel playoff-queue">
          <header className="panel-header">
            <h2>Unapplied conference games</h2>
            <p>
              {pending.length} final{pending.length === 1 ? "" : "s"} not on the ledger yet.
              Championship games are omitted. Apply ESPN&apos;s winner, or undo the last apply.
            </p>
          </header>
          <div className="playoff-queue-actions">
            <button
              type="button"
              className="ghost-btn"
              disabled={!live.appliedGameIds.length}
              onClick={() => patch(undoLastAppliedGame(live, games))}
            >
              Undo last apply
            </button>
          </div>
          {pendingGroups.map((group) => (
            <div key={group.conference} className="playoff-queue-group">
              <h3>
                {group.label}{" "}
                <span>
                  {group.games.length} game{group.games.length === 1 ? "" : "s"}
                </span>
              </h3>
              <ul>
                {group.games.map((game) => {
                  const winnerId = gameWinnerId(game);
                  const homeWon = winnerId === game.homeTeamId;
                  return (
                    <li key={game.id}>
                      <span className="playoff-queue-week">{formatGameWeekShort(game.week)}</span>
                      <span className={homeWon ? "playoff-loser" : "playoff-winner"}>
                        {game.awayName} {game.awayScore}
                      </span>
                      <span className="playoff-queue-at">@</span>
                      <span className={homeWon ? "playoff-winner" : "playoff-loser"}>
                        {game.homeName} {game.homeScore}
                      </span>
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={!winnerId}
                        onClick={() => patch(applyConferenceGame(live, game))}
                      >
                        Apply
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ) : (
        <section className="panel playoff-queue">
          <header className="panel-header">
            <h2>Unapplied conference games</h2>
            <p>All conference finals on the slate are on the ledger.</p>
          </header>
          <button
            type="button"
            className="ghost-btn"
            disabled={!live.appliedGameIds.length}
            onClick={() => patch(undoLastAppliedGame(live, games))}
          >
            Undo last apply
          </button>
        </section>
      )}

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

      <div className="playoff-layout">
        <div className="playoff-grid">
          {tables.map((table) => (
            <section key={table.conference} className="playoff-table">
              <header>
                <h3>{table.label}</h3>
                <span>{table.gamesInSeason || "—"}</span>
              </header>
              <ol>
                {table.standing.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    state={live}
                    cfpRank={ranks.get(team.id)}
                    gamesInSeason={conferenceGamesForTeam(games, team.id)}
                    showGamesCol={table.label === "ACC"}
                    onCycle={() => patch(cycleTeamStatus(live, team))}
                    onAdjust={(field, delta) =>
                      patch(adjustConferenceRecord(live, team.id, field, delta))
                    }
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
                        cfpRank={ranks.get(team.id)}
                        onCycle={() => patch(cycleTeamStatus(live, team))}
                        onAdjust={(field, delta) =>
                          patch(adjustConferenceRecord(live, team.id, field, delta))
                        }
                      />
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>
          ))}
        </div>

        <aside className="playoff-rail">
          <section className="playoff-rail-card auto-bid">
            <header>
              <h3>Auto Bid</h3>
              <span>5 highest CFP-ranked champs</span>
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
              <span>7 highest ranked after auto bids</span>
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

            <h4>At-large pool</h4>
            <p className="playoff-pool-copy">
              Notre Dame plus ranked teams eliminated from their conference race. Drop a team
              here if they are out of the playoff too.
            </p>
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
                      onClick={() => patch(eliminateFromAtLarge(live, team.id))}
                    >
                      Eliminate
                    </button>
                  </li>
                );
              })}
              {!atLargePool.length ? (
                <li className="playoff-empty">No at-large pool teams right now.</li>
              ) : null}
            </ul>
          </section>

          <section className="playoff-rail-card eliminated">
            <header>
              <h3>Independents · eliminated</h3>
              <span>UConn stays here. Notre Dame joins if you eliminate them.</span>
            </header>
            <ol>
              {independents.map((team) => (
                <li key={team.id}>
                  <TeamLogo team={team} />
                  <div>
                    <strong>{team.shortName}</strong>
                    {isNotreDame(team) ? (
                      <em>
                        {live.notreDameRecord.wins}-{live.notreDameRecord.losses} overall
                      </em>
                    ) : (
                      <em>Independent</em>
                    )}
                  </div>
                  {isNotreDame(team) ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => patch(restoreToAtLarge(live, team.id))}
                    >
                      Restore
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TeamRow({
  team,
  state,
  cfpRank,
  gamesInSeason,
  showGamesCol,
  onCycle,
  onAdjust,
}: {
  team: Team;
  state: PlayoffRaceState;
  cfpRank?: number;
  gamesInSeason?: number;
  showGamesCol?: boolean;
  onCycle: () => void;
  onAdjust: (field: "wins" | "losses", delta: number) => void;
}) {
  const rec = conferenceRecord(state, team.id);
  const status = teamPlayoffStatus(state, team);
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
        </strong>
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
      {showGamesCol ? <span className="playoff-games">{gamesInSeason ?? ""}</span> : null}
    </li>
  );
}
