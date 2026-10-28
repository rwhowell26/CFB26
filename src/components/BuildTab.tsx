"use client";

import { useEffect, useMemo } from "react";
import { BuildResultResume } from "@/components/BuildResultResume";
import { TeamLogo } from "@/components/TeamLogo";
import { TeamResume } from "@/components/TeamResume";
import { orderUnrankedCandidates } from "@/lib/ranking-logic";
import {
  applyPairwiseChoice,
  emptyPairwiseSession,
  initPairwiseSession,
  snapshotCheckpoint,
  preparePairwiseQuestion,
  questionCopy,
  reconcilePairwiseSession,
  remainingScrubCount,
  skipCurrentScrubPhase,
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
  lastWeekLabel?: string;
  onCommit: (rankedIds: string[], session: PairwiseSession) => void;
  onOpenRank: () => void;
};

const CONTEXT_RADIUS = 5;

function contextIds(rankedIds: string[], leftId: string, rightId: string) {
  const left = rankedIds.indexOf(leftId);
  const right = rankedIds.indexOf(rightId);
  if (left < 0 || right < 0) return [];
  const lo = Math.min(left, right);
  const hi = Math.max(left, right);
  const start = Math.max(0, lo - CONTEXT_RADIUS);
  const end = Math.min(rankedIds.length, hi + CONTEXT_RADIUS + 1);
  return rankedIds.slice(start, end);
}

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
  lastWeekLabel,
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

  const totalTeams = teams.length || FBS_TEAM_COUNT;
  const live = useMemo(() => {
    if (rankedIds.length >= totalTeams) {
      const base =
        session?.week === week ? session : emptyPairwiseSession(week);
      return preparePairwiseQuestion(base, rankedIds, records, totalTeams);
    }
    const ranked = new Set(rankedIds);
    const remaining = orderRemaining(allIds.filter((id) => !ranked.has(id)));
    const base = session
      ? reconcilePairwiseSession(session, week, rankedIds, allIds, orderRemaining)
      : initPairwiseSession(week, rankedIds, remaining);
    return preparePairwiseQuestion(base, rankedIds, records, totalTeams);
  }, [allIds, orderRemaining, rankedIds, records, session, totalTeams, week]);

  const question = live.question;
  const left = question ? teamsById.get(question.leftId) : null;
  const right = question ? teamsById.get(question.rightId) : null;
  const copy = question ? questionCopy(question.kind) : null;
  const scrubbing = rankedIds.length >= totalTeams && totalTeams > 0;
  const complete = scrubbing && !question;
  const climbing = Boolean(live.session.scrubClimbingId);
  const scrubLeft = scrubbing ? remainingScrubCount(rankedIds, records, live.session) : 0;
  const neighbors =
    question && scrubbing ? contextIds(rankedIds, question.leftId, question.rightId) : [];

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
      session?.queue.length === live.session.queue.length &&
      (session?.scrubConfirmed ?? []).join() ===
        (live.session.scrubConfirmed ?? []).join() &&
      (session?.scrubPhase ?? 1) === (live.session.scrubPhase ?? 1) &&
      (session?.scrubClimbingId ?? null) === (live.session.scrubClimbingId ?? null) &&
      (session?.scrubBlendGroup ?? null) === (live.session.scrubBlendGroup ?? null);
    if (sameRanked && sameCursor) return;
    onCommit(live.rankedIds, live.session);
  }, [live, onCommit, rankedIds, session]);

  const pick = (winnerId: string, loserId: string) => {
    const next = applyPairwiseChoice(
      live.session,
      live.rankedIds,
      winnerId,
      loserId,
      records,
      totalTeams,
    );
    onCommit(next.rankedIds, next.session);
  };

  const undo = () => {
    const source = live.session.history.length ? live.session : session;
    if (!source) return;
    const prev = undoPairwiseChoice(source);
    if (!prev) return;
    onCommit(prev.rankedIds, prev.session);
  };

  const keepRemaining = () => {
    const history = [
      ...live.session.history,
      snapshotCheckpoint(rankedIds, live.session),
    ];
    onCommit(rankedIds, {
      ...skipCurrentScrubPhase(live.session),
      history,
    });
  };

  if (complete) {
    return (
      <section className="panel build-wrap">
        <header className="panel-header">
          <p className="eyebrow">Build · {formatWeekLabel(week, weekLabel)}</p>
          <h2>Preference pass complete</h2>
          <p>
            All {totalTeams} teams were seeded by losses, then last week&apos;s SOW/SOL.
            Your swaps are on the ballot. Drag on Rank for anything else.
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

  const seedNote = lastWeekLabel ?? "last week";
  const blendGroup = live.session.scrubBlendGroup;
  const progress = !scrubbing
    ? `${rankedIds.length}/${totalTeams} on the ballot · ${live.session.queue.length}${live.session.insertingId ? " + 1" : ""} left to place`
    : question.kind === "blend"
      ? climbing
        ? `Phase 2 · ${right.shortName} climbing · SOW/SOL from this ballot`
        : `Phase 2 · blending ${blendGroup ?? "?"}-loss teams into fewer losses · most losses first`
      : `Phase 1 · ${scrubLeft} same-loss pair${scrubLeft === 1 ? "" : "s"} left · most losses first · seeded from ${seedNote}`;

  const leftRole =
    question.kind === "insert"
      ? "Unplaced team"
      : question.kind === "blend" && climbing
        ? "Team above"
        : question.kind === "scrub" || question.kind === "blend"
          ? "Currently higher"
          : "Team A";
  const rightRole =
    question.kind === "insert"
      ? "Already on ballot"
      : question.kind === "blend" && climbing
        ? "Climbing"
        : question.kind === "scrub" || question.kind === "blend"
          ? "Currently lower"
          : "Team B";

  return (
    <div className="build-wrap">
      <section className="panel">
        <header className="panel-header">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>Who belongs higher?</h2>
          <p>{copy.prompt}</p>
          <p>{progress}</p>
        </header>
        <div className="build-actions">
          <button type="button" className="primary-btn" onClick={() => pick(left.id, right.id)}>
            {left.shortName} higher
          </button>
          <button type="button" className="primary-btn" onClick={() => pick(right.id, left.id)}>
            {right.shortName} higher
          </button>
          {scrubbing ? (
            <button type="button" className="ghost-btn" onClick={keepRemaining}>
              Skip rest of this phase
            </button>
          ) : null}
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

      {neighbors.length ? (
        <ol className="build-context">
          {neighbors.map((id, index) => {
            const team = teamsById.get(id);
            if (!team) return null;
            const rank = rankedIds.indexOf(id) + 1;
            const rec = records.get(id) ?? { wins: 0, losses: 0 };
            const compared = id === left.id || id === right.id;
            return (
              <li
                key={id}
                className={`build-context-row${compared ? " compared" : ""}`}
              >
                <span className="build-context-rank">#{rank}</span>
                <TeamLogo team={team} />
                <span className="build-context-name">{team.shortName}</span>
                <span className="build-context-rec">
                  {rec.wins}-{rec.losses}
                </span>
                {compared ? (
                  <span className="build-context-tag">
                    {id === left.id ? "higher" : "lower"}
                  </span>
                ) : index === 0 && rank > 1 ? (
                  <span className="build-context-tag muted">+{rank - 1} above</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="build-resumes">
        <button type="button" className="build-pick" onClick={() => pick(left.id, right.id)}>
          {scrubbing ? (
            <BuildResultResume
              team={left}
              games={games}
              currentRanks={currentRanks}
              priorRanks={priorRanks}
              roleLabel={leftRole}
            />
          ) : (
            <TeamResume
              team={left}
              games={games}
              currentRanks={currentRanks}
              priorRanks={priorRanks}
              resumeRanks={resumeRanks}
              roleLabel={leftRole}
            />
          )}
        </button>
        <button type="button" className="build-pick" onClick={() => pick(right.id, left.id)}>
          {scrubbing ? (
            <BuildResultResume
              team={right}
              games={games}
              currentRanks={currentRanks}
              priorRanks={priorRanks}
              roleLabel={rightRole}
            />
          ) : (
            <TeamResume
              team={right}
              games={games}
              currentRanks={currentRanks}
              priorRanks={priorRanks}
              resumeRanks={resumeRanks}
              roleLabel={rightRole}
            />
          )}
        </button>
      </div>
    </div>
  );
}
