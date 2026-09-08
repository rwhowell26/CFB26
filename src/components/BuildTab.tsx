"use client";

import { useEffect, useMemo } from "react";
import { TeamResume } from "@/components/TeamResume";
import { orderUnrankedCandidates } from "@/lib/ranking-logic";
import {
  applyPairwiseChoice,
  initPairwiseSession,
  preparePairwiseQuestion,
  questionCopy,
  reconcilePairwiseSession,
  undoPairwiseChoice,
} from "@/lib/pairwise-build";
import { FBS_TEAM_COUNT, formatWeekLabel } from "@/lib/season";
import type { PriorRank } from "@/lib/storage";
import type { Game, PairwiseSession, Team } from "@/lib/types";

type Props = {
  week: number;
  weekLabel?: string;
  teams: Team[];
  teamsById: Map<string, Team>;
  rankedIds: string[];
  session: PairwiseSession | undefined;
  games: Game[];
  records: Map<string, { wins: number; losses: number }>;
  lastWeekRanks: Map<string, number>;
  currentRanks: Map<string, number>;
  priorRanks: Map<string, PriorRank>;
  resumeRanks: Map<string, number>;
  onCommit: (rankedIds: string[], session: PairwiseSession) => void;
  onOpenRank: () => void;
};

export function BuildTab({
  week,
  weekLabel,
  teams,
  teamsById,
  rankedIds,
  session,
  games,
  records,
  lastWeekRanks,
  currentRanks,
  priorRanks,
  resumeRanks,
  onCommit,
  onOpenRank,
}: Props) {
  const allIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const orderRemaining = useMemo(() => {
    return (ids: string[]) =>
      orderUnrankedCandidates(
        ids,
        records,
        lastWeekRanks,
        games,
        resumeRanks,
        (id) => teamsById.get(id)?.name ?? id,
      );
  }, [records, lastWeekRanks, games, resumeRanks, teamsById]);

  const live = useMemo(() => {
    const ranked = new Set(rankedIds);
    const remaining = orderRemaining(allIds.filter((id) => !ranked.has(id)));
    const base = session
      ? reconcilePairwiseSession(session, week, rankedIds, allIds, orderRemaining)
      : initPairwiseSession(week, rankedIds, remaining);
    return preparePairwiseQuestion(base, rankedIds);
  }, [allIds, orderRemaining, rankedIds, session, week]);

  const question = live.question;
  const left = question ? teamsById.get(question.leftId) : null;
  const right = question ? teamsById.get(question.rightId) : null;
  const copy = question ? questionCopy(question.kind) : null;
  const complete = rankedIds.length >= FBS_TEAM_COUNT && !question;

  useEffect(() => {
    const sameRanked =
      live.rankedIds.length === rankedIds.length &&
      live.rankedIds.every((id, i) => id === rankedIds[i]);
    const sameCursor =
      session?.week === live.session.week &&
      session?.insertingId === live.session.insertingId &&
      session?.lo === live.session.lo &&
      session?.hi === live.session.hi &&
      session?.sincePair === live.session.sincePair &&
      session?.queue.length === live.session.queue.length;
    if (sameRanked && sameCursor) return;
    onCommit(live.rankedIds, live.session);
  }, [live, onCommit, rankedIds, session]);

  const pick = (winnerId: string, loserId: string) => {
    const next = applyPairwiseChoice(live.session, live.rankedIds, winnerId, loserId);
    onCommit(next.rankedIds, next.session);
    if (next.rankedIds.length >= FBS_TEAM_COUNT) onOpenRank();
  };

  const undo = () => {
    const source = live.session.history.length ? live.session : session;
    if (!source) return;
    const prev = undoPairwiseChoice(source);
    if (!prev) return;
    onCommit(prev.rankedIds, prev.session);
  };

  if (complete) {
    return (
      <section className="panel build-wrap">
        <header className="panel-header">
          <p className="eyebrow">Build · {formatWeekLabel(week, weekLabel)}</p>
          <h2>Ballot complete</h2>
          <p>
            All {FBS_TEAM_COUNT} teams are ranked from your team-vs-team picks. Further changes
            happen on the Rank tab.
          </p>
        </header>
        <button type="button" className="primary-btn" onClick={onOpenRank}>
          Edit on Rank
        </button>
      </section>
    );
  }

  if (!question || !left || !right || !copy) {
    return (
      <section className="panel build-wrap">
        <header className="panel-header">
          <p className="eyebrow">Build · {formatWeekLabel(week, weekLabel)}</p>
          <h2>Need more teams</h2>
          <p>Season data is still loading, or there are not two teams left to compare.</p>
        </header>
      </section>
    );
  }

  return (
    <div className="build-wrap">
      <section className="panel">
        <header className="panel-header">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>Who belongs higher?</h2>
          <p>{copy.prompt}</p>
          <p>
            {rankedIds.length}/{FBS_TEAM_COUNT} on the ballot · {live.session.queue.length}
            {live.session.insertingId ? " + 1" : ""} left to place · no pair is decided for you
          </p>
        </header>
        <div className="build-actions">
          <button type="button" className="primary-btn" onClick={() => pick(left.id, right.id)}>
            {left.shortName} higher
          </button>
          <button type="button" className="primary-btn" onClick={() => pick(right.id, left.id)}>
            {right.shortName} higher
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={!live.session.history.length && !(session?.history.length ?? 0)}
            onClick={undo}
          >
            Undo
          </button>
        </div>
      </section>

      <div className="build-resumes">
        <button type="button" className="build-pick" onClick={() => pick(left.id, right.id)}>
          <TeamResume
            team={left}
            games={games}
            currentRanks={currentRanks}
            priorRanks={priorRanks}
            resumeRanks={resumeRanks}
            roleLabel={question.kind === "insert" ? "Unplaced team" : "Team A"}
          />
        </button>
        <button type="button" className="build-pick" onClick={() => pick(right.id, left.id)}>
          <TeamResume
            team={right}
            games={games}
            currentRanks={currentRanks}
            priorRanks={priorRanks}
            resumeRanks={resumeRanks}
            roleLabel={question.kind === "insert" ? "Already on ballot" : "Team B"}
          />
        </button>
      </div>
    </div>
  );
}
