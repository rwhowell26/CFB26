"use client";

import {
  computeSos,
  formatResumeRank,
  gamesForTeam,
  recordFromGames,
} from "@/lib/ranking-logic";
import { shortConferenceName } from "@/lib/conferences";
import { formatGameWeekShort } from "@/lib/season";
import type { PriorRank } from "@/lib/storage";
import { resolveResumeRank } from "@/lib/storage";
import type { Game, Team } from "@/lib/types";

type Props = {
  team: Team;
  games: Game[];
  currentRanks: Map<string, number>;
  priorRanks: Map<string, PriorRank>;
  resumeRanks: Map<string, number>;
  roleLabel?: string;
  onClose?: () => void;
};

function loc(location: "home" | "away" | "neutral") {
  if (location === "home") return "vs";
  if (location === "away") return "@";
  return "n";
}

export function TeamResume({
  team,
  games,
  currentRanks,
  priorRanks,
  resumeRanks,
  roleLabel,
  onClose,
}: Props) {
  const schedule = gamesForTeam(team.id, games, resumeRanks);
  const played = schedule.filter((g) => g.status === "final");
  const upcoming = schedule.filter((g) => g.status !== "final");
  const record = recordFromGames(team.id, games);
  const sos = computeSos(team.id, games, resumeRanks);
  const teamResolved = resolveResumeRank(team.id, currentRanks, priorRanks);

  const oppLabel = (opponentId: string | null, opponentIsFbs: boolean) => {
    if (!opponentIsFbs || !opponentId) return formatResumeRank(null, opponentIsFbs);
    return formatResumeRank(resolveResumeRank(opponentId, currentRanks, priorRanks), true);
  };

  const rankStr = teamResolved ? formatResumeRank(teamResolved, true) : "";

  return (
    <section className="resume-compact">
      <header className="rc-header">
        <div className="rc-id">
          {team.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt="" className="team-logo" />
          ) : null}
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
        {onClose ? (
          <button type="button" className="ghost-btn rc-close" onClick={onClose}>
            ✕
          </button>
        ) : null}
      </header>

      <div className="rc-stats">
        <span>SOS {sos.playedAvgRank != null ? sos.playedAvgRank.toFixed(1) : "—"}</span>
        <span>SOW {sos.winAvgRank != null ? sos.winAvgRank.toFixed(1) : "—"}</span>
        <span>SOL {sos.lossAvgRank != null ? sos.lossAvgRank.toFixed(1) : "—"}</span>
        <span>Rem {sos.remainingAvgRank != null ? sos.remainingAvgRank.toFixed(1) : "—"}</span>
        <span>{played.length}P · {upcoming.length}R</span>
      </div>

      <ul className="rc-schedule">
        {schedule.map((g) => {
          const final = g.status === "final";
          return (
            <li
              key={g.gameId}
              className={`rc-game${final && g.result ? ` result-${g.result.toLowerCase()}` : ""}${final ? "" : " muted-row"}`}
            >
              <span className="rc-wk">{formatGameWeekShort(g.week)}</span>
              <span className="rc-loc">{loc(g.location)}</span>
              <span className="rc-opp">
                {oppLabel(g.opponentId, g.opponentIsFbs)} {g.opponentName}
              </span>
              <span className="rc-sc">
                {final && g.result != null
                  ? `${g.result} ${g.teamScore}-${g.opponentScore}`
                  : new Date(g.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
