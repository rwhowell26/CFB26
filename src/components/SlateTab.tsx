"use client";

import { useMemo, useState } from "react";
import { formatRank, gamesForSlateWeek } from "@/lib/ranking-logic";
import { PRESEASON_WEEK, WEEK_ZERO, formatWeekLabel } from "@/lib/season";
import type { Game, SeasonWeek } from "@/lib/types";

type Props = {
  games: Game[];
  weeks: SeasonWeek[];
  /** Calendar week from ESPN (0 = preseason) */
  seasonWeek: number;
  ranks: Map<string, number>;
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

function statusLabel(game: Game): string {
  if (game.status === "final" && game.homeScore != null && game.awayScore != null) {
    return `${game.awayScore}-${game.homeScore}`;
  }
  if (game.status === "in_progress") return "LIVE";
  return new Date(game.date).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayName(name: string): string {
  return name.replace(/\s+University$/, "").replace(/^University of\s+/i, "");
}

function SlateGameRow({
  game,
  homeRank,
  awayRank,
  highlight,
  onSelectTeam,
  selectedTeamId,
}: {
  game: Game;
  homeRank: number | null;
  awayRank: number | null;
  highlight?: boolean;
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
}) {
  return (
    <li className={`slate-game ${highlight ? "slate-best" : ""}`}>
      <div className="slate-matchup">
        <button
          type="button"
          className={`slate-team slate-away ${selectedTeamId === game.awayTeamId ? "selected" : ""}`}
          onClick={() => game.awayIsFbs && onSelectTeam?.(game.awayTeamId)}
          disabled={!game.awayIsFbs}
        >
          {game.awayLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.awayLogo} alt="" className="team-logo" />
          ) : (
            <span className="team-logo-fallback team-logo" aria-hidden>
              ·
            </span>
          )}
          <span className="slate-rank">{formatRank(awayRank, game.awayIsFbs)}</span>
          <strong>{displayName(game.awayName)}</strong>
        </button>
        <span className="slate-at">@</span>
        <button
          type="button"
          className={`slate-team slate-home ${selectedTeamId === game.homeTeamId ? "selected" : ""}`}
          onClick={() => game.homeIsFbs && onSelectTeam?.(game.homeTeamId)}
          disabled={!game.homeIsFbs}
        >
          <strong>{displayName(game.homeName)}</strong>
          <span className="slate-rank">{formatRank(homeRank, game.homeIsFbs)}</span>
          {game.homeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.homeLogo} alt="" className="team-logo" />
          ) : (
            <span className="team-logo-fallback team-logo" aria-hidden>
              ·
            </span>
          )}
        </button>
      </div>
      <div className="slate-meta">
        {game.neutralSite ? <span className="slate-neutral">Neutral</span> : null}
        <span>{statusLabel(game)}</span>
      </div>
    </li>
  );
}

export function SlateTab({
  games,
  weeks,
  seasonWeek,
  ranks,
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
    () => [...slate].sort((a, b) => b.interest - a.interest).slice(0, 10),
    [slate],
  );

  const weekMeta = weeks.find((w) => w.number === slateWeek);
  const label = formatWeekLabel(slateWeek, weekMeta?.label);
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

      <section className="panel">
        <header className="panel-header">
          <h2>Best games · {label}</h2>
          <p>Top matchups by your rankings.</p>
        </header>
        {!best.length ? (
          <div className="empty-state">No games found for {label}.</div>
        ) : (
          <ol className="slate-list">
            {best.map((row, index) => (
              <SlateGameRow
                key={row.game.id}
                game={row.game}
                homeRank={row.homeRank}
                awayRank={row.awayRank}
                highlight={index < 3}
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
            {slate.length} game{slate.length === 1 ? "" : "s"} · sorted by kickoff
          </p>
        </header>
        {!slate.length ? (
          <div className="empty-state">No games found for {label}.</div>
        ) : (
          <ul className="slate-list">
            {slate.map((row) => (
              <SlateGameRow
                key={row.game.id}
                game={row.game}
                homeRank={row.homeRank}
                awayRank={row.awayRank}
                onSelectTeam={onSelectTeam}
                selectedTeamId={selectedTeamId}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
