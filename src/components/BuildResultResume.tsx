"use client";

import { TeamLogo } from "@/components/TeamLogo";
import { shortConferenceName } from "@/lib/conferences";
import {
  computeSos,
  formatResumeRank,
  gamesForTeam,
  recordFromGames,
} from "@/lib/ranking-logic";
import type { PriorRank } from "@/lib/storage";
import { resolveResumeRank } from "@/lib/storage";
import type { Game, Team, TeamGameView } from "@/lib/types";

type Props = {
  team: Team;
  games: Game[];
  currentRanks: Map<string, number>;
  priorRanks: Map<string, PriorRank>;
  roleLabel?: string;
};

function loc(location: "home" | "away" | "neutral") {
  if (location === "home") return "vs";
  if (location === "away") return "@";
  return "n";
}

function resultSortKey(game: TeamGameView) {
  if (!game.opponentIsFbs) return Number.POSITIVE_INFINITY;
  return game.opponentRank ?? Number.POSITIVE_INFINITY - 1;
}

function ResultColumn({ title, games }: { title: string; games: TeamGameView[] }) {
  const sorted = [...games].sort((a, b) => resultSortKey(a) - resultSortKey(b));
  return (
    <div className="build-wl-col">
      <h4>
        {title} <span>{sorted.length}</span>
      </h4>
      <ul className="build-wl-list">
        {sorted.length ? (
          sorted.map((g) => {
            const rank = !g.opponentIsFbs
              ? "FCS"
              : g.opponentRank != null
                ? `#${g.opponentRank}`
                : "NR";
            return (
              <li
                key={g.gameId}
                className={`rc-game result-${(g.result ?? "w").toLowerCase()}`}
              >
                <span className="rc-loc">{loc(g.location)}</span>
                <span className="rc-opp">
                  {rank} {g.opponentName}
                </span>
                <span className="rc-sc">
                  {g.teamScore}-{g.opponentScore}
                </span>
              </li>
            );
          })
        ) : (
          <li className="build-wl-empty">None</li>
        )}
      </ul>
    </div>
  );
}

export function BuildResultResume({
  team,
  games,
  currentRanks,
  priorRanks,
  roleLabel,
}: Props) {
  const schedule = gamesForTeam(team.id, games, currentRanks);
  const played = schedule.filter((g) => g.status === "final");
  const wins = played.filter((g) => g.result === "W");
  const losses = played.filter((g) => g.result === "L");
  const record = recordFromGames(team.id, games);
  const sos = computeSos(team.id, games, currentRanks);
  const teamResolved = resolveResumeRank(team.id, currentRanks, priorRanks);
  const rankStr = teamResolved ? formatResumeRank(teamResolved, true) : "";

  return (
    <section className="resume-compact">
      <header className="rc-header">
        <div className="rc-id">
          <TeamLogo team={team} />
          <div>
            {roleLabel ? <p className="eyebrow">{roleLabel}</p> : null}
            <h3>
              {rankStr ? `${rankStr} ` : ""}
              {team.shortName}
            </h3>
            <p className="rc-sub">
              {record.wins}-{record.losses} · {shortConferenceName(team.conference)}
            </p>
          </div>
        </div>
      </header>

      <div className="rc-stats">
        <span>SOS {sos.playedAvgRank != null ? sos.playedAvgRank.toFixed(1) : "—"}</span>
        <span>SOW {sos.winAvgRank != null ? sos.winAvgRank.toFixed(1) : "—"}</span>
        <span>SOL {sos.lossAvgRank != null ? sos.lossAvgRank.toFixed(1) : "—"}</span>
      </div>

      <div className="build-wl">
        <ResultColumn title="Wins" games={wins} />
        <ResultColumn title="Losses" games={losses} />
      </div>
    </section>
  );
}
