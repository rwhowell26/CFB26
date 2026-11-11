"use client";

import { CbbCompareCard } from "@/components/CbbCompareCard";
import { TeamLogo } from "@/components/TeamLogo";
import {
  assignField,
  bestTeamByConference,
  liveFieldPreview,
  recommendNewTeams,
  seedWorkingPool,
  snapshotFromAssignment,
  spotForTeam,
  spotFromRank,
  spotLabel,
} from "@/lib/cbb-bracket";
import { emptyMetrics, formatRecord, overallAverage, formatRank } from "@/lib/cbb-metrics";
import { FIELD_SIZE, FIRST_FOUR_OUT, PLAY_IN_TEAMS, formatCbbDate } from "@/lib/cbb-season";
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
      <strong>{team.shortName}</strong>
      <span className="cbb-scurve-meta">
        {formatRecord(team.wins, team.losses)}
        {playIn ? " · Play-in" : ""}
      </span>
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
    const rankedIds = seedWorkingPool(teams, metrics, previousForSeed);
    onStoreChange({
      draft: emptyDraft(rankedIds, previousForSeed?.id ?? null),
      viewingId: previousForSeed?.id ?? null,
    });
  };

  const cancelDraft = () => {
    onStoreChange({ draft: null, viewingId: latest?.id ?? null });
  };

  if (draft) {
    const recommended = recommendNewTeams(teams, metrics, previousForSeed);
    const question = nextScrubQuestion(draft);
    const left = question ? teamsById.get(question.leftId) : null;
    const right = question ? teamsById.get(question.rightId) : null;
    const leftMetrics = question ? metricsFor(metrics, question.leftId) : null;
    const rightMetrics = question ? metricsFor(metrics, question.rightId) : null;
    const remaining = remainingScrubCount(draft);
    const preview = liveFieldPreview(draft.rankedIds, teamsById, conferences);
    const assignment = assignField(
      draft.rankedIds,
      teamsById,
      conferences,
      bestTeamByConference(teams, teamsById, metrics),
    );

    const pick = (winnerId: string, loserId: string) => {
      onStoreChange({ draft: applyScrubChoice(draft, winnerId, loserId, recommended) });
    };

    const save = () => {
      const snapshot = snapshotFromAssignment(assignment, draft.rankedIds, recommended);
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
                {Object.keys(assignment.autoBidByConference).length} auto-bids ·{" "}
                {assignment.field.filter((row) => row.playIn).length} play-in. First 4 out and next 4
                out are listed below.
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

    return (
      <div className="cbb-bracketology">
        <section className="panel cbb-scrub-bar">
          <header className="panel-header">
            <p className="eyebrow">
              Bracketology ·{" "}
              {question.phase === "recommend"
                ? "recommended climb"
                : `${spotLabel(spotFromRank(question.leftRank))} #${question.leftRank} vs ${spotLabel(spotFromRank(question.rightRank))} #${question.rightRank}`}
            </p>
            <h2>Who belongs higher?</h2>
            <p>
              {question.phase === "recommend"
                ? `${remaining} recommended team${remaining === 1 ? "" : "s"} left to place`
                : `${remaining} pair${remaining === 1 ? "" : "s"} left`}
              {" · "}
              {preview.atLarge} at-large / {preview.autoBids} auto
              {preview.reserved ? ` · ${preview.reserved} reserved` : ""}
              {" · "}
              {assignment.field.filter((row) => row.playIn).length}/{PLAY_IN_TEAMS} play-in
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
              onClick={() => onStoreChange({ draft: skipRemainingScrub(draft, recommended) })}
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
        <CbbCompareCard
          left={left}
          right={right}
          leftMetrics={leftMetrics}
          rightMetrics={rightMetrics}
          leftRole={question.phase === "recommend" ? "Team above" : "Currently higher"}
          rightRole={question.phase === "recommend" ? "Climbing" : "Currently lower"}
          leftSpot={{
            ...spotFromRank(question.leftRank),
            playIn: spotForTeam(left.id, draft.rankedIds, assignment).playIn,
          }}
          rightSpot={{
            ...spotFromRank(question.rightRank),
            playIn: spotForTeam(right.id, draft.rankedIds, assignment).playIn,
          }}
          onPickLeft={() => pick(left.id, right.id)}
          onPickRight={() => pick(right.id, left.id)}
        />
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
    new Map(Object.entries(snapshot.autoBidByConference)),
  );
  return (
    <>
      <p className="cbb-saved-meta">
        Saved {formatCbbDate(snapshot.createdAt)} · {assignment.field.length}/{FIELD_SIZE} field ·{" "}
        {assignment.atLargeIds.length} at-large · {Object.keys(assignment.autoBidByConference).length}{" "}
        auto-bids · {assignment.field.filter((row) => row.playIn).length}/{PLAY_IN_TEAMS} play-in
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
        {[...bySeed.entries()].map(([seed, rows]) => (
          <div key={seed} className="cbb-seed-block">
            <h3>
              {seed}-seeds
              {rows.some((row) => row.playIn) ? (
                <span className="cbb-seed-count">
                  {" "}
                  · {rows.filter((row) => row.playIn).length} play-in
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
        ))}
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
