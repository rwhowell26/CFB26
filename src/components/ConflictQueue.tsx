"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamResume } from "@/components/TeamResume";
import {
  findDirectH2hGame,
  h2hPairKey,
  uniqueH2hConflicts,
} from "@/lib/ranking-logic";
import { formatGameWeekShort } from "@/lib/season";
import type { PriorRank } from "@/lib/storage";
import type { Game, MoveSuggestion, PhilosophyWarning, Team } from "@/lib/types";

type CycleNote = { a: string; b: string; aName: string; bName: string };

type Props = {
  suggestions: MoveSuggestion[];
  warnings: PhilosophyWarning[];
  cycleNotes?: CycleNote[];
  teamsById: Map<string, Team>;
  games: Game[];
  currentRanks: Map<string, number>;
  priorRanks: Map<string, PriorRank>;
  resumeRanks: Map<string, number>;
  onApply: (suggestion: MoveSuggestion) => void;
  onApplyAll: (suggestions: MoveSuggestion[]) => void;
  onSelectTeam?: (teamId: string) => void;
};

function scoreLine(game: Game, winnerId: string): string {
  const winnerScore = game.homeTeamId === winnerId ? game.homeScore : game.awayScore;
  const loserScore = game.homeTeamId === winnerId ? game.awayScore : game.homeScore;
  if (winnerScore == null || loserScore == null) return "Final";
  return `${winnerScore}-${loserScore}`;
}

export function ConflictQueue({
  suggestions,
  warnings,
  cycleNotes = [],
  teamsById,
  games,
  currentRanks,
  priorRanks,
  resumeRanks,
  onApply,
  onApplyAll,
  onSelectTeam,
}: Props) {
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);

  const pairs = useMemo(() => {
    return uniqueH2hConflicts(suggestions).filter(
      (s) => !ignored.has(h2hPairKey(s.winnerId, s.loserId)),
    );
  }, [suggestions, ignored]);

  useEffect(() => {
    if (index >= pairs.length) setIndex(Math.max(0, pairs.length - 1));
  }, [pairs.length, index]);

  const current = pairs[index] ?? null;
  const loser = current ? teamsById.get(current.loserId) : null;
  const winner = current ? teamsById.get(current.winnerId) : null;
  const h2hGame = current
    ? findDirectH2hGame(games, current.winnerId, current.loserId)
    : null;

  const undefeated = warnings.filter((w) => w.type === "undefeated_behind_loss");
  const winless = warnings.filter((w) => w.type === "winless_not_bottom");
  const quiet =
    !pairs.length && !undefeated.length && !winless.length && !cycleNotes.length;

  const go = (delta: number) => {
    if (!pairs.length) return;
    setIndex((prev) => (prev + delta + pairs.length) % pairs.length);
  };

  const ignoreCurrent = () => {
    if (!current) return;
    const key = h2hPairKey(current.winnerId, current.loserId);
    setIgnored((prev) => new Set(prev).add(key));
  };

  if (quiet) {
    return (
      <div className="warnings ok">
        No auto-suggest flags — nobody is ahead of a team they lost to or behind a team they
        beat on the current ballot.
      </div>
    );
  }

  return (
    <div className="conflict-queue">
      <section className="panel find-replace">
        <header className="find-replace-bar">
          <div>
            <p className="eyebrow">Head-to-head</p>
            <h2>Find &amp; replace conflicts</h2>
            <p>
              {pairs.length
                ? `${index + 1} of ${pairs.length} remaining`
                : "No remaining H2H conflicts"}
              {ignored.size ? ` · ${ignored.size} ignored` : ""}
            </p>
          </div>
          <div className="find-replace-nav">
            <button type="button" className="ghost-btn" onClick={() => go(-1)} disabled={pairs.length < 2}>
              Previous
            </button>
            <button type="button" className="ghost-btn" onClick={() => go(1)} disabled={pairs.length < 2}>
              Next
            </button>
          </div>
        </header>

        {current && loser && winner ? (
          <>
            <div className="find-replace-match">
              <p className="find-replace-headline">
                {loser.shortName} (#{current.teamRank}) is ahead of {winner.shortName} (#
                {current.relatedRank}) after losing the H2H.
              </p>
              {h2hGame ? (
                <p className="find-replace-result">
                  {formatGameWeekShort(h2hGame.week)} · {winner.shortName} beat {loser.shortName}{" "}
                  {scoreLine(h2hGame, winner.id)}
                  {h2hGame.neutralSite ? " · Neutral" : ""}
                </p>
              ) : null}
            </div>

            <div className="find-replace-actions">
              <button type="button" className="primary-btn" onClick={() => onApply(current)}>
                Auto-fix
              </button>
              <button type="button" className="ghost-btn" onClick={ignoreCurrent}>
                Ignore
              </button>
              {pairs.length > 1 ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => onApplyAll(pairs)}
                >
                  Fix remaining ({pairs.length})
                </button>
              ) : null}
            </div>

            <div className="resume-compare">
              <TeamResume
                team={loser}
                games={games}
                currentRanks={currentRanks}
                priorRanks={priorRanks}
                resumeRanks={resumeRanks}
                roleLabel="Currently ahead · lost the H2H"
              />
              <TeamResume
                team={winner}
                games={games}
                currentRanks={currentRanks}
                priorRanks={priorRanks}
                resumeRanks={resumeRanks}
                roleLabel="Currently behind · won the H2H"
              />
            </div>
          </>
        ) : (
          <p className="warnings-intro">
            Remaining flags below are not direct head-to-head swaps.
          </p>
        )}
      </section>

      {cycleNotes.length ? (
        <div className="warn-block panel">
          <h4>Opinion gaps / win cycles ({cycleNotes.length})</h4>
          <p className="warnings-intro">
            These teams beat into each other through a chain — results alone don’t settle the
            order.
          </p>
          <ul>
            {cycleNotes.slice(0, 12).map((c) => (
              <li key={`${c.a}-${c.b}`}>
                <button type="button" className="suggest-msg" onClick={() => onSelectTeam?.(c.a)}>
                  {c.aName}
                </button>
                {" ↔ "}
                <button type="button" className="suggest-msg" onClick={() => onSelectTeam?.(c.b)}>
                  {c.bName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {undefeated.length ? (
        <div className="warn-block panel">
          <h4>Also: undefeated behind a loss ({undefeated.length})</h4>
          <ul>
            {undefeated.slice(0, 8).map((w, i) => (
              <li key={`${w.teamId}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {winless.length ? (
        <div className="warn-block panel">
          <h4>Also: winless above a winner ({winless.length})</h4>
          <ul>
            {winless.slice(0, 8).map((w, i) => (
              <li key={`${w.teamId}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
