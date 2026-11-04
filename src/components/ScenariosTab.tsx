"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEASON_YEAR } from "@/lib/season";
import {
  SCENARIO_CONFERENCES,
  defaultScenarioConference,
  type ScenarioConferenceId,
} from "@/lib/scenario-conferences";
import {
  conferencesPresent,
  projectConference,
  type RankedScenarioRow,
  type ScenarioTable,
} from "@/lib/scenario-engine";
import { formatPct, formatWinLoss, groupGamesByWeek } from "@/lib/sunbelt";
import { conferenceForTeam, teamsInConference } from "@/lib/scenario-conferences";
import {
  conferenceContention,
  proofPicksCopy,
  scenarioProofPicks,
  weekSwingsThisWeek,
} from "@/lib/ccg-contention";
import { CcgStatusCard } from "@/components/CcgStatusCard";
import type { Game, Team } from "@/lib/types";

const CONF_KEY = `cfb26-scenario-conference-${SEASON_YEAR}`;
const picksKey = (id: ScenarioConferenceId) => `cfb26-scenario-picks-${SEASON_YEAR}-${id}`;

type Props = {
  teams: Team[];
  games: Game[];
  cfpRanks?: Map<string, number>;
  week?: number;
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
};

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadStoredConferenceId(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONF_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string" && parsed) return parsed;
  } catch {
    if (!raw.startsWith("{") && !raw.startsWith("[")) return raw;
  }
  return null;
}

function loadPicks(id: ScenarioConferenceId): Record<string, string> {
  const parsed = loadJson<unknown>(picksKey(id), {});
  const fromNew =
    parsed && typeof parsed === "object"
      ? Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};
  if (Object.keys(fromNew).length > 0 || id !== "sunbelt") return fromNew;
  const legacy = loadJson<unknown>(`cfb26-sunbelt-picks-${SEASON_YEAR}`, {});
  if (!legacy || typeof legacy !== "object") return {};
  return Object.fromEntries(
    Object.entries(legacy as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
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

function dropFinishedPicks(
  picks: Record<string, string>,
  games: Game[],
): Record<string, string> {
  const next = { ...picks };
  let changed = false;
  for (const game of games) {
    if (gameWinnerId(game) && next[game.id]) {
      delete next[game.id];
      changed = true;
    }
  }
  return changed ? next : picks;
}

export function ScenariosTab({
  teams,
  games,
  cfpRanks,
  week,
  onSelectTeam,
  selectedTeamId,
}: Props) {
  const available = useMemo(() => conferencesPresent(teams), [teams]);
  const selectedConfId = (() => {
    if (!selectedTeamId) return undefined;
    const team = teams.find((item) => item.id === selectedTeamId);
    return team ? conferenceForTeam(team)?.id : undefined;
  })();
  const [conferenceId, setConferenceId] = useState<ScenarioConferenceId>(
    () => selectedConfId ?? "sunbelt",
  );
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [picksReady, setPicksReady] = useState(() => Boolean(selectedConfId));
  const [conferenceHydrated, setConferenceHydrated] = useState(() => Boolean(selectedConfId));
  const [hideCompleted, setHideCompleted] = useState(true);
  const appliedProofKey = useRef("");
  const conferenceIdRef = useRef(conferenceId);
  conferenceIdRef.current = conferenceId;

  useEffect(() => {
    if (conferenceHydrated || available.length === 0) return;
    const stored = loadStoredConferenceId();
    const selectedTeam = selectedTeamId
      ? teams.find((team) => team.id === selectedTeamId)
      : undefined;
    const selectedConfId = selectedTeam
      ? conferenceForTeam(selectedTeam)?.id
      : undefined;
    const match =
      available.find((conf) => conf.id === selectedConfId) ??
      available.find((conf) => conf.id === stored) ??
      available[0];
    const id = match?.id ?? defaultScenarioConference(SCENARIO_CONFERENCES);
    setConferenceId(id);
    setPicks(loadPicks(id));
    setPicksReady(true);
    setConferenceHydrated(true);
  }, [available, conferenceHydrated, selectedTeamId, teams]);

  useEffect(() => {
    if (!picksReady) return;
    window.localStorage.setItem(CONF_KEY, JSON.stringify(conferenceId));
    window.localStorage.setItem(picksKey(conferenceId), JSON.stringify(picks));
  }, [conferenceId, picks, picksReady]);

  const conference =
    available.find((conf) => conf.id === conferenceId) ?? available[0] ?? SCENARIO_CONFERENCES[0];

  useEffect(() => {
    setPicks((prev) => dropFinishedPicks(prev, games));
  }, [games]);

  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const current = useMemo(
    () => projectConference(conference, teams, games, { cfpRanks }),
    [conference, teams, games, cfpRanks],
  );
  const projected = useMemo(
    () => projectConference(conference, teams, games, { picks, cfpRanks }),
    [conference, teams, games, picks, cfpRanks],
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

  const changeConference = useCallback((id: ScenarioConferenceId) => {
    appliedProofKey.current = "";
    setConferenceId(id);
    setPicks(loadPicks(id));
  }, []);

  useEffect(() => {
    if (!conferenceHydrated || !selectedTeamId) return;
    const team = teams.find((item) => item.id === selectedTeamId);
    const conf = team ? conferenceForTeam(team) : null;
    if (!conf || !available.some((item) => item.id === conf.id)) return;
    if (conf.id === conferenceIdRef.current) return;
    changeConference(conf.id);
  }, [available, changeConference, conferenceHydrated, selectedTeamId, teams]);

  const nameOf = (id: string | null) =>
    id ? (teamsById.get(id)?.shortName ?? id) : "TBD";
  const divided = Boolean(conference.divisions?.length);
  const showDiv = divided;
  const members = useMemo(
    () =>
      teamsInConference(teams, conference).sort((a, b) =>
        a.shortName.localeCompare(b.shortName),
      ),
    [teams, conference],
  );
  const contention = useMemo(
    () => conferenceContention(conference, teams, games, { cfpRanks, week }),
    [conference, teams, games, cfpRanks, week],
  );
  const selectedTeam = selectedTeamId ? teamsById.get(selectedTeamId) : undefined;
  const selectedInConf =
    selectedTeam && conferenceForTeam(selectedTeam)?.id === conference.id
      ? selectedTeam
      : undefined;
  const selectedRow = selectedInConf
    ? (contention.byTeam.get(selectedInConf.id) ?? null)
    : null;
  const weekSwings = useMemo(() => {
    if (!selectedInConf) return [];
    return weekSwingsThisWeek(conference, selectedInConf.id, teams, games, {
      cfpRanks,
      week,
    });
  }, [selectedInConf, conference, teams, games, cfpRanks, week]);

  const applyProofPicks = () => {
    if (!selectedInConf) return;
    appliedProofKey.current = `${conference.id}:${selectedInConf.id}`;
    setPicks(
      scenarioProofPicks(conference, teams, games, selectedInConf.id, {
        cfpRanks,
        week,
      }),
    );
  };

  useEffect(() => {
    if (!picksReady || !selectedInConf) return;
    const key = `${conference.id}:${selectedInConf.id}`;
    if (appliedProofKey.current === key) return;
    appliedProofKey.current = key;
    setPicks(
      scenarioProofPicks(conference, teams, games, selectedInConf.id, {
        cfpRanks,
        week,
      }),
    );
  }, [picksReady, conference, selectedInConf?.id, teams, games, cfpRanks, week]);

  return (
    <div className="sbc-wrap">
      <section className="panel sbc-top">
        <header className="panel-header sbc-top-header">
          <label className="sbc-conf-select">
            <span>Conference</span>
            <select
              value={conference.id}
              onChange={(e) => changeConference(e.target.value as ScenarioConferenceId)}
            >
              {available.map((conf) => (
                <option key={conf.id} value={conf.id}>
                  {conf.label}
                </option>
              ))}
            </select>
          </label>
          <label className="sbc-conf-select">
            <span>Team scenario</span>
            <select
              value={selectedInConf?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id) onSelectTeam?.(id);
              }}
            >
              <option value="">Select a team</option>
              {members.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.shortName}
                </option>
              ))}
            </select>
          </label>
          <p className="sbc-champ-line">
            <strong>CCG</strong> {nameOf(projected.championship.homeId)} vs{" "}
            {nameOf(projected.championship.awayId)}
            <span> · {projected.championship.note}</span>
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

      {selectedInConf && selectedRow ? (
        <CcgStatusCard
          team={selectedInConf}
          row={selectedRow}
          weekSwings={weekSwings}
          teamsById={teamsById}
        />
      ) : null}

      <div className={`sbc-boards${divided ? "" : " single"}`}>
        {projected.tables.map((table) => (
          <DivisionCard
            key={`proj-${table.id}`}
            title={divided ? `Projected ${table.label}` : "Projected"}
            table={table}
            teamsById={teamsById}
            selectedTeamId={selectedTeamId}
            onSelectTeam={onSelectTeam}
            showDiv={showDiv}
          />
        ))}
        {current.tables.map((table) => (
          <DivisionCard
            key={`curr-${table.id}`}
            title={divided ? `Current ${table.label}` : "Current"}
            table={table}
            teamsById={teamsById}
            selectedTeamId={selectedTeamId}
            onSelectTeam={onSelectTeam}
            compact
            showDiv={false}
          />
        ))}
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
              onClick={applyProofPicks}
              disabled={!selectedInConf}
            >
              Prove status
            </button>
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
        {selectedInConf && selectedRow ? (
          <p className="sbc-proof-note">{proofPicksCopy(selectedRow.status, selectedInConf.shortName)}</p>
        ) : null}
        {remainingWeeks.length === 0 ? (
          <p className="sbc-empty">No remaining conference games on the ESPN slate.</p>
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
  showDiv,
}: {
  title: string;
  table: ScenarioTable;
  teamsById: Map<string, Team>;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string) => void;
  compact?: boolean;
  showDiv: boolean;
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
                  {showDiv ? <th scope="col">Div</th> : null}
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
                showDiv={showDiv && !compact}
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
  showDiv,
}: {
  row: RankedScenarioRow;
  team: Team | undefined;
  selected: boolean;
  onSelectTeam?: (teamId: string) => void;
  compact: boolean;
  showDiv: boolean;
}) {
  const name = compact ? shortLabel(team, row.teamId) : (team?.shortName ?? row.teamId);
  return (
    <tr
      className={`${row.champion || row.titleGame ? "champ" : ""} ${selected ? "selected" : ""}`}
    >
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
          {showDiv && row.division ? <td>{formatWinLoss(row.division)}</td> : null}
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
