"use client";

import { CbbCompareCard } from "@/components/CbbCompareCard";
import { TeamLogo } from "@/components/TeamLogo";
import {
  assignField,
  bestTeamByConference,
  draftSCurve,
  liveReserveCounts,
  padAboveSlots,
  playInCap,
  recommendNewTeams,
  remainingAutoBidIds,
  seedWorkingPool,
  snapshotFromAssignment,
  spotForTeam,
  spotLabel,
  teamsAboveCurrent,
} from "@/lib/cbb-bracket";
import { emptyMetrics, formatRecord, overallAverage, formatRank } from "@/lib/cbb-metrics";
import {
  COMPLETED_ABOVE,
  FIELD_SIZE,
  FIRST_FOUR_OUT,
  PLAY_IN_GAMES,
  PLAY_IN_TEAMS,
  formatCbbDate,
} from "@/lib/cbb-season";
import {
  applyScrubChoice,
  emptyDraft,
  nextScrubQuestion,
  remainingScrubCount,
  skipRemainingScrub,
  undoScrubChoice,
} from "@/lib/cbb-scrub";
import type { CbbDraft, CbbSnapshot, CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

type Props = {
  teams: CbbTeam[];
  metrics: Map<string, CbbTeamMetrics>;
  conferences: string[];
  snapshots: CbbSnapshot[];
  draft: CbbDraft | null;
  viewingId: string | null;
  onStoreChange: (next: {
    snapshots?: CbbSnapshot[];
    draft?: CbbDraft | null;
    viewingId?: string | null;
  }) => void;
};

function metricsFor(map: Map<string, CbbTeamMetrics>, id: string): CbbTeamMetrics {
  return map.get(id) ?? emptyMetrics(id);
}

function TeamRow({
  team,
  rank,
  seed,
  role,
  playIn,
  metrics,
}: {
  team: CbbTeam;
  rank: number;
  seed?: number;
  role?: string;
  playIn?: boolean;
  metrics: CbbTeamMetrics;
}) {
  return (
    <li
      className={`cbb-scurve-row${role === "auto-bid" ? " auto" : role === "at-large" ? " at-large" : ""}${
        playIn ? " play-in" : ""
      }`}
    >
      <span className="cbb-scurve-rank">{seed != null ? `${seed}` : "·"}</span>
      <span className="cbb-scurve-idx">#{rank}</span>
      <TeamLogo team={team} />
      <strong>
        {team.shortName}
        {playIn ? <span className="cbb-pi">PI</span> : null}
      </strong>
      <span className="cbb-scurve-meta">{formatRecord(team.wins, team.losses)}</span>
      <span className="cbb-scurve-avg">{formatRank(overallAverage(metrics), 1)}</span>
    </li>
  );
}

export function BracketologyTab({
  teams,
  metrics,
  conferences,
  snapshots,
  draft,
  viewingId,
  onStoreChange,
}: Props) {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const latest = snapshots[0] ?? null;
  const viewing = snapshots.find((item) => item.id === viewingId) ?? latest;
  const previousForSeed = latest;

  const startNew = () => {
    const rankedIds = seedWorkingPool(teams, metrics, previousForSeed, conferences);
    onStoreChange({
      draft: emptyDraft(rankedIds, previousForSeed?.id ?? null),
      viewingId: previousForSeed?.id ?? null,
    });
  };

  const cancelDraft = () => {
    onStoreChange({ draft: null, viewingId: latest?.id ?? null });
  };

  if (draft) {
    const recommended = recommendNewTeams(teams, metrics, previousForSeed, undefined, draft.rankedIds);
    const autoBidIds = remainingAutoBidIds(
      draft.rankedIds,
      teams,
      metrics,
      conferences,
      previousForSeed,
    );
    const question = nextScrubQuestion(draft);
    const left = question ? teamsById.get(question.leftId) : null;
    const right = question ? teamsById.get(question.rightId) : null;
    const leftMetrics = question ? metricsFor(metrics, question.leftId) : null;
    const rightMetrics = question ? metricsFor(metrics, question.rightId) : null;
    const remaining = remainingScrubCount(draft);
    const curve = draftSCurve(draft.rankedIds, draft.autoBidIds);
    const bestByConf = bestTeamByConference(teams, teamsById, metrics);
    const assignment = assignField(curve, teamsById, conferences, bestByConf);
    const placedForReserve =
      question?.phase === "at-large"
        ? draft.rankedIds.slice(0, Math.max(0, question.leftRank - 1))
        : question?.phase === "recommend"
          ? draft.rankedIds.slice(0, Math.max(0, question.leftRank))
          : draft.rankedIds;
    const live = liveReserveCounts(placedForReserve, teamsById, bestByConf, conferences);
    const reserves =
      question?.phase === "auto-bid" || !question
        ? {
            atLargeSpots: assignment.atLargeIds.length,
            reserved: assignment.autoBidsReserved,
            total: assignment.autoBidsTotal,
            playInRemaining: assignment.field.filter((row) => row.playIn).length,
          }
        : live;

    const pick = (winnerId: string, loserId: string) => {
      onStoreChange({ draft: applyScrubChoice(draft, winnerId, loserId, recommended, autoBidIds) });
    };

    const save = () => {
      const snapshot = snapshotFromAssignment(
        assignment,
        draftSCurve(draft.rankedIds, draft.autoBidIds),
        recommended,
      );
      onStoreChange({
        snapshots: [snapshot, ...snapshots],
        draft: null,
        viewingId: snapshot.id,
      });
    };

    if (!question || !left || !right || !leftMetrics || !rightMetrics) {
      return (
        <div className="cbb-bracketology">
          <section className="panel">
            <header className="panel-header">
              <p className="eyebrow">Bracketology · preference pass</p>
              <h2>Seed list locked</h2>
              <p>
                {assignment.field.length} in the field · {assignment.atLargeIds.length} at-large ·{" "}
                {assignment.autoBidsReserved}/{assignment.autoBidsTotal} auto-bid ·{" "}
                {assignment.field.filter((row) => row.playIn).length}/{playInCap(assignment.autoBidsReserved)} play-in
                · {PLAY_IN_GAMES} Opening Round games. Last 4 in, first 4 out, and next 4 out used the
                at-large cut; 12–16 auto-bids were scrubbed separately.
              </p>
            </header>
            <div className="build-actions">
              <button type="button" className="primary-btn" onClick={save}>
                Save this projection
              </button>
              <button type="button" className="ghost-btn" onClick={cancelDraft}>
                Discard
              </button>
            </div>
          </section>
          <ProjectionLists
            assignment={assignment}
            teamsById={teamsById}
            metrics={metrics}
            recommendedIds={recommended}
          />
        </div>
      );
    }

    const aboveSlots = padAboveSlots(teamsAboveCurrent(curve, question.leftRank));

    return (
      <div className="cbb-bracketology">
        <section className="panel cbb-scrub-bar">
          <header className="panel-header">
            <p className="eyebrow">
              {question.phase === "recommend"
                ? "Recommended climb"
                : question.phase === "auto-bid"
                  ? `Auto-bid 12–16 · ${spotLabel(spotForTeam(left.id, curve, assignment))} vs ${spotLabel(spotForTeam(right.id, curve, assignment))}`
                  : `${spotLabel(spotForTeam(left.id, curve, assignment))} vs ${spotLabel(spotForTeam(right.id, curve, assignment))}`}
            </p>
            <p>
              {question.phase === "recommend"
                ? `${remaining} recommended team${remaining === 1 ? "" : "s"} left`
                : question.phase === "auto-bid"
                  ? `${remaining} auto-bid pair${remaining === 1 ? "" : "s"} left`
                  : `${remaining} at-large pair${remaining === 1 ? "" : "s"} left`}
              {" · "}
              {reserves.atLargeSpots} at-large · {reserves.reserved}/{reserves.total} auto-bid ·{" "}
              {reserves.playInRemaining}/{PLAY_IN_TEAMS} play-in · {PLAY_IN_GAMES} Opening Round games
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
              onClick={() => onStoreChange({ draft: skipRemainingScrub(draft, recommended, autoBidIds) })}
            >
              Keep remaining order
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={!draft.history.length}
              onClick={() => {
                const prev = undoScrubChoice(draft);
                if (prev) onStoreChange({ draft: prev });
              }}
            >
              Undo
            </button>
            <button type="button" className="ghost-btn" onClick={cancelDraft}>
              Cancel
            </button>
          </div>
        </section>
        <div className="cbb-scrub-stage">
          <aside className="cbb-completed-rail" aria-label="Completed spots above">
            <h3>
              Above
              <span>
                {Math.min(COMPLETED_ABOVE, Math.max(0, question.leftRank - 1))} / {COMPLETED_ABOVE}
              </span>
            </h3>
            <ol>
              {aboveSlots.map((id, index) => {
                if (!id) {
                  return <li key={`empty-${index}`} className="cbb-scurve-row is-empty" />;
                }
                const team = teamsById.get(id);
                if (!team) return <li key={id} className="cbb-scurve-row is-empty" />;
                const rank = curve.indexOf(id) + 1;
                const spot = spotForTeam(id, curve, assignment);
                return (
                  <TeamRow
                    key={id}
                    team={team}
                    rank={rank}
                    seed={spot.seed ?? undefined}
                    role={assignment.field.find((item) => item.teamId === id)?.role}
                    playIn={spot.playIn}
                    metrics={metricsFor(metrics, id)}
                  />
                );
              })}
            </ol>
          </aside>
          <CbbCompareCard
            left={left}
            right={right}
            leftMetrics={leftMetrics}
            rightMetrics={rightMetrics}
            leftRole={
              question.phase === "recommend"
                ? "Team above"
                : question.phase === "auto-bid"
                  ? "Higher auto-bid"
                  : "Currently higher"
            }
            rightRole={
              question.phase === "recommend"
                ? "Climbing"
                : question.phase === "auto-bid"
                  ? "Lower auto-bid"
                  : "Currently lower"
            }
            leftSpot={spotForTeam(left.id, curve, assignment)}
            rightSpot={spotForTeam(right.id, curve, assignment)}
            assignment={assignment}
            teamsById={teamsById}
            onPickLeft={() => pick(left.id, right.id)}
            onPickRight={() => pick(right.id, left.id)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="cbb-bracketology">
      <section className="panel cbb-results-bar">
        <header className="panel-header">
          <p className="eyebrow">Bracketology</p>
          <h2>{viewing ? viewing.label : "No projections yet"}</h2>
        </header>
        <div className="cbb-toolbar">
          <label className="week-select">
            Past projections
            <select
              value={viewing?.id ?? ""}
              onChange={(event) => onStoreChange({ viewingId: event.target.value || null })}
              disabled={!snapshots.length}
            >
              {!snapshots.length ? <option value="">None saved</option> : null}
              {snapshots.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.id === latest?.id ? " · latest" : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary-btn" onClick={startNew}>
            Start new
          </button>
        </div>
      </section>

      {!viewing ? (
        <div className="empty-state">
          No bracketology saved yet. Start a new projection to scrub from a metric-seeded S-curve.
        </div>
      ) : (
        <SavedProjection
          snapshot={viewing}
          teamsById={teamsById}
          metrics={metrics}
          conferences={conferences}
        />
      )}
    </div>
  );
}

function SavedProjection({
  snapshot,
  teamsById,
  metrics,
  conferences,
}: {
  snapshot: CbbSnapshot;
  teamsById: Map<string, CbbTeam>;
  metrics: Map<string, CbbTeamMetrics>;
  conferences: string[];
}) {
  const assignment = assignField(
    snapshot.sCurve,
    teamsById,
    conferences,
    // Recompute from live metrics. A saved autoBidByConference can still
    // name a teammate who was first on the S-curve, which parked the real
    // conference leader (Grand Canyon) in Next 4 Out.
    bestTeamByConference([...teamsById.values()], teamsById, metrics),
  );
  return (
    <>
      <p className="cbb-saved-meta">
        Saved {formatCbbDate(snapshot.createdAt)} · {assignment.field.length}/{FIELD_SIZE} field ·{" "}
        {assignment.atLargeIds.length} at-large · {assignment.autoBidsReserved}/{assignment.autoBidsTotal} auto-bid
        · {assignment.field.filter((row) => row.playIn).length}/{playInCap(assignment.autoBidsReserved)} play-in ·{" "}
        {PLAY_IN_GAMES} Opening Round games
      </p>
      <ProjectionLists
        assignment={assignment}
        teamsById={teamsById}
        metrics={metrics}
        recommendedIds={snapshot.recommendedIds}
      />
    </>
  );
}

function ProjectionLists({
  assignment,
  teamsById,
  metrics,
  recommendedIds,
}: {
  assignment: ReturnType<typeof assignField>;
  teamsById: Map<string, CbbTeam>;
  metrics: Map<string, CbbTeamMetrics>;
  recommendedIds: string[];
}) {
  const bySeed = new Map<number, typeof assignment.field>();
  for (const row of assignment.field) {
    const list = bySeed.get(row.seed) ?? [];
    list.push(row);
    bySeed.set(row.seed, list);
  }
  for (const rows of bySeed.values()) {
    rows.sort((left, right) => left.sCurveIndex - right.sCurveIndex);
  }

  const renderIds = (ids: string[], startRank: number) => (
    <ol className="cbb-scurve">
      {ids.map((id, index) => {
        const team = teamsById.get(id);
        if (!team) return null;
        return (
          <TeamRow
            key={id}
            team={team}
            rank={startRank + index}
            metrics={metricsFor(metrics, id)}
          />
        );
      })}
    </ol>
  );

  return (
    <div className="cbb-projection">
      <div className="cbb-seed-grid">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((seed) => {
          const rows = bySeed.get(seed);
          if (!rows?.length) return null;
          return (
            <div key={seed} className="cbb-seed-block">
              <h3>
                {seed}-seeds
                {rows.some((row) => row.playIn) ? (
                  <span className="cbb-seed-count">
                    {" "}
                    · {rows.filter((row) => row.playIn).length} play-in ·{" "}
                    {rows.length - rows.filter((row) => row.playIn).length / 2} spots
                  </span>
                ) : null}
              </h3>
              <ol className="cbb-scurve">
                {rows.map((row) => {
                  const team = teamsById.get(row.teamId);
                  if (!team) return null;
                  return (
                    <TeamRow
                      key={row.teamId}
                      team={team}
                      rank={row.sCurveIndex + 1}
                      seed={row.seed}
                      role={row.role}
                      playIn={row.playIn}
                      metrics={metricsFor(metrics, row.teamId)}
                    />
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>

      <div className="cbb-bubble-grid">
        <section className="panel">
          <header className="panel-header">
            <h2>First 4 out</h2>
          </header>
          {assignment.firstFourOut.length ? renderIds(assignment.firstFourOut, FIELD_SIZE + 1) : (
            <p className="empty-state">None yet.</p>
          )}
        </section>
        <section className="panel">
          <header className="panel-header">
            <h2>Next 4 out</h2>
          </header>
          {assignment.nextFourOut.length ? renderIds(assignment.nextFourOut, FIELD_SIZE + FIRST_FOUR_OUT + 1) : (
            <p className="empty-state">None yet.</p>
          )}
        </section>
        <section className="panel">
          <header className="panel-header">
            <h2>Recommended</h2>
          </header>
          {recommendedIds.length ? renderIds(recommendedIds, 1) : (
            <p className="empty-state">None this board.</p>
          )}
        </section>
      </div>
    </div>
  );
}
