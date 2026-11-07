"use client";

import { useMemo, useState } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { CcgStatusCard } from "@/components/CcgStatusCard";
import { conferenceForTeam } from "@/lib/scenario-conferences";
import {
  allConferenceContention,
  weekSwingsThisWeek,
  type CcgWeekSwing,
} from "@/lib/ccg-contention";
import { emptyPlayoffRace, teamPlayoffStatus } from "@/lib/playoff-race";
import { formatRank, gamesForSlateWeek } from "@/lib/ranking-logic";
import { PRESEASON_WEEK, WEEK_ZERO, formatWeekLabel } from "@/lib/season";
import type { Game, PlayoffRaceState, PlayoffStatus, SeasonWeek, Team } from "@/lib/types";

type Props = {
  games: Game[];
  weeks: SeasonWeek[];
  teams: Team[];
  /** Calendar week from ESPN (0 = preseason) */
  seasonWeek: number;
  ranks: Map<string, number>;
  playoffState?: PlayoffRaceState;
  cfpRanks?: Map<string, number>;
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
};

function resolveSlateWeek(seasonWeek: number, weeks: SeasonWeek[], games: Game[]): number {
  // Prefer current calendar week when it has games (Week 0+)
  if (seasonWeek >= WEEK_ZERO && games.some((g) => g.week === seasonWeek)) {
    return seasonWeek;
  }
  if (seasonWeek === PRESEASON_WEEK || seasonWeek < WEEK_ZERO) {
    const week0 = weeks.find((w) => w.number === WEEK_ZERO);
    if (week0 && games.some((g) => g.week === WEEK_ZERO)) return WEEK_ZERO;
  }
  const withGames = weeks
    .filter((w) => w.number >= WEEK_ZERO)
    .find((w) => games.some((g) => g.week === w.number));
  return withGames?.number ?? WEEK_ZERO;
}

function kickoffTime(game: Game): string {
  if (game.status === "final") return "Final";
  if (game.status === "in_progress") return "LIVE";
  return new Date(game.date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function scoreTone(
  teamScore: number | null,
  oppScore: number | null,
  status: Game["status"],
): "winner" | "loser" | undefined {
  if (status !== "final" || teamScore == null || oppScore == null || teamScore === oppScore) {
    return undefined;
  }
  return teamScore > oppScore ? "winner" : "loser";
}

function TeamScore({
  score,
  oppScore,
  status,
}: {
  score: number | null;
  oppScore: number | null;
  status: Game["status"];
}) {
  const tone = scoreTone(score, oppScore, status);
  return (
    <span className={`slate-score${tone ? ` ${tone}` : ""}`}>
      {score != null ? score : ""}
    </span>
  );
}

function localDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function displayName(name: string): string {
  return name.replace(/\s+University$/, "").replace(/^University of\s+/i, "");
}

function playoffClass(status: PlayoffStatus | undefined): string {
  return status && status !== "alive" ? status : "";
}

function SlateGameRow({
  game,
  homeRank,
  awayRank,
  highlight,
  elimHint,
  homeStatus,
  awayStatus,
  onSelectTeam,
  selectedTeamId,
}: {
  game: Game;
  homeRank: number | null;
  awayRank: number | null;
  highlight?: boolean;
  elimHint?: string;
  homeStatus?: PlayoffStatus;
  awayStatus?: PlayoffStatus;
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
}) {
  return (
    <li className={`slate-game ${highlight ? "slate-best" : ""} ${elimHint ? "slate-elim" : ""}`}>
      <div className="slate-matchup">
        <button
          type="button"
          className={`slate-team slate-away ${selectedTeamId === game.awayTeamId ? "selected" : ""} ${playoffClass(awayStatus)}`}
          onClick={() => game.awayIsFbs && onSelectTeam?.(game.awayTeamId)}
          disabled={!game.awayIsFbs}
        >
          <TeamLogo
            team={{
              id: game.awayTeamId,
              logo: game.awayLogo,
              color: game.awayColor,
              alternateColor: game.awayAlternateColor,
            }}
          />
          <span className="slate-rank">{formatRank(awayRank, game.awayIsFbs)}</span>
          <strong>{displayName(game.awayName)}</strong>
          <TeamScore score={game.awayScore} oppScore={game.homeScore} status={game.status} />
        </button>
        <span className="slate-at">@</span>
        <button
          type="button"
          className={`slate-team slate-home ${selectedTeamId === game.homeTeamId ? "selected" : ""} ${playoffClass(homeStatus)}`}
          onClick={() => game.homeIsFbs && onSelectTeam?.(game.homeTeamId)}
          disabled={!game.homeIsFbs}
        >
          <TeamLogo
            team={{
              id: game.homeTeamId,
              logo: game.homeLogo,
              color: game.homeColor,
              alternateColor: game.homeAlternateColor,
            }}
          />
          <span className="slate-rank">{formatRank(homeRank, game.homeIsFbs)}</span>
          <strong>{displayName(game.homeName)}</strong>
          <TeamScore score={game.homeScore} oppScore={game.awayScore} status={game.status} />
        </button>
      </div>
      <div className="slate-meta">
        {game.neutralSite ? <span className="slate-neutral">Neutral</span> : null}
        <span>{kickoffTime(game)}</span>
      </div>
      {elimHint ? <p className="slate-elim-copy">{elimHint}</p> : null}
    </li>
  );
}

export function SlateTab({
  games,
  weeks,
  teams,
  seasonWeek,
  ranks,
  playoffState,
  cfpRanks,
  onSelectTeam,
  selectedTeamId,
}: Props) {
  const defaultWeek = resolveSlateWeek(seasonWeek, weeks, games);
  const regularWeeks = useMemo(() => weeks.filter((w) => w.number >= WEEK_ZERO), [weeks]);
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const slateWeek =
    viewWeek != null && regularWeeks.some((w) => w.number === viewWeek)
      ? viewWeek
      : defaultWeek;

  const slate = useMemo(
    () => gamesForSlateWeek(games, slateWeek, ranks),
    [games, slateWeek, ranks],
  );

  const best = useMemo(
    () => [...slate].sort((a, b) => b.interest - a.interest).slice(0, 12),
    [slate],
  );

  const slateByDay = useMemo(() => {
    const groups = new Map<string, typeof slate>();
    for (const row of slate) {
      const key = localDayKey(row.game.date);
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([key, rows]) => ({
      key,
      label: localDayLabel(rows[0]!.game.date),
      rows,
    }));
  }, [slate]);

  const weekMeta = weeks.find((w) => w.number === slateWeek);
  const label = formatWeekLabel(slateWeek, weekMeta?.label);
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const livePlayoff = playoffState ?? emptyPlayoffRace();
  const contention = useMemo(
    () => allConferenceContention(teams, games, { cfpRanks, week: slateWeek }),
    [teams, games, cfpRanks, slateWeek],
  );
  const selectedTeam = selectedTeamId ? teamsById.get(selectedTeamId) : undefined;
  const selectedConf = selectedTeam ? conferenceForTeam(selectedTeam) : null;
  const selectedCcg =
    selectedTeam && selectedConf
      ? (contention.get(selectedConf.id)?.byTeam.get(selectedTeam.id) ?? null)
      : null;
  const weekSwings = useMemo((): CcgWeekSwing[] => {
    if (!selectedTeam || !selectedConf) return [];
    return weekSwingsThisWeek(selectedConf, selectedTeam.id, teams, games, {
      cfpRanks,
      week: slateWeek,
    });
  }, [selectedTeam, selectedConf, teams, games, cfpRanks, slateWeek]);
  const elimByGame = useMemo(() => {
    const map = new Map<string, string>();
    if (!selectedTeam) return map;
    for (const item of weekSwings) {
      const winner = teamsById.get(item.winnerId)?.shortName ?? item.winnerId;
      const bit =
        item.kind === "clinches"
          ? `${winner} winning clinches a CCG berth`
          : `${winner} winning eliminates ${selectedTeam.shortName}`;
      const prev = map.get(item.game.id);
      map.set(item.game.id, prev ? `${prev}; ${bit}` : bit);
    }
    return map;
  }, [weekSwings, selectedTeam, teamsById]);
  const playoffOf = (teamId: string, isFbs: boolean): PlayoffStatus | undefined => {
    if (!isFbs) return undefined;
    const team = teamsById.get(teamId);
    if (!team) return undefined;
    return teamPlayoffStatus(livePlayoff, team);
  };
  const preseasonNote =
    seasonWeek === PRESEASON_WEEK
      ? "Preseason ballot week — showing Week 0 games when available."
      : null;

  return (
    <div className="slate-wrap">
      <section className="panel">
        <header className="panel-header">
          <h2>This week’s slate</h2>
          <p>
            Matchups with your ballot ranks. Best games weight highly ranked teams and close
            rank gaps.
          </p>
        </header>
        <label className="block-label">
          Slate week
          <select
            value={String(slateWeek)}
            onChange={(e) => setViewWeek(Number(e.target.value))}
          >
            {regularWeeks.map((w) => (
              <option key={w.number} value={String(w.number)}>
                {w.label}
                {w.number === seasonWeek ? " · current" : ""}
              </option>
            ))}
          </select>
        </label>
        {preseasonNote ? <p className="movers-note">{preseasonNote}</p> : null}
      </section>

      {selectedTeam && selectedCcg ? (
        <CcgStatusCard
          team={selectedTeam}
          row={selectedCcg}
          weekSwings={weekSwings}
          teamsById={teamsById}
        />
      ) : (
        <p className="slate-hint">Select a team to see CCG scenarios.</p>
      )}

      <section className="panel">
        <header className="panel-header">
          <h2>Best games · {label}</h2>
          <p>Top matchups by your rankings.</p>
        </header>
        {!best.length ? (
          <div className="empty-state">No games found for {label}.</div>
        ) : (
          <ol className="slate-list slate-list-3col">
            {best.map((row, index) => (
              <SlateGameRow
                key={row.game.id}
                game={row.game}
                homeRank={row.homeRank}
                awayRank={row.awayRank}
                highlight={index < 3}
                elimHint={elimByGame.get(row.game.id)}
                homeStatus={playoffOf(row.game.homeTeamId, row.game.homeIsFbs)}
                awayStatus={playoffOf(row.game.awayTeamId, row.game.awayIsFbs)}
                onSelectTeam={onSelectTeam}
                selectedTeamId={selectedTeamId}
              />
            ))}
          </ol>
        )}
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Full slate · {label}</h2>
          <p>
            {slate.length} game{slate.length === 1 ? "" : "s"} · grouped by day
          </p>
        </header>
        {!slate.length ? (
          <div className="empty-state">No games found for {label}.</div>
        ) : (
          <div className="slate-days">
            {slateByDay.map((day) => (
              <section key={day.key} className="slate-day">
                <h3 className="slate-day-heading">
                  {day.label}
                  <span>
                    {day.rows.length} game{day.rows.length === 1 ? "" : "s"}
                  </span>
                </h3>
                <ul className="slate-list slate-list-3col">
                  {day.rows.map((row) => (
                    <SlateGameRow
                      key={row.game.id}
                      game={row.game}
                      homeRank={row.homeRank}
                      awayRank={row.awayRank}
                      elimHint={elimByGame.get(row.game.id)}
                      homeStatus={playoffOf(row.game.homeTeamId, row.game.homeIsFbs)}
                      awayStatus={playoffOf(row.game.awayTeamId, row.game.awayIsFbs)}
                      onSelectTeam={onSelectTeam}
                      selectedTeamId={selectedTeamId}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
