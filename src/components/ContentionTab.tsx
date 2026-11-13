"use client";

import { useEffect, useMemo } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import {
  applyContentionMove,
  applyContentionMoves,
  contentionCandidates,
  contentionMoves,
  contentionRosterIds,
  withCandidateReasons,
  type ContentionCandidate,
  type ContentionMove,
  type ContentionReason,
} from "@/lib/cbb-contention";
import { shortCbbConference } from "@/lib/cbb-conferences";
import { formatRank, formatRecord, overallAverage } from "@/lib/cbb-metrics";
import { CONTENTION_WITHIN } from "@/lib/cbb-season";
import type { CbbSnapshot, CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

type Props = {
  teams: CbbTeam[];
  metrics: Map<string, CbbTeamMetrics>;
  snapshot: CbbSnapshot | null;
  approvedIds: string[] | null;
  onApprovedIds: (ids: string[]) => void;
};

const REASON_LABEL: Record<ContentionReason, string> = {
  field: "Field",
  "first-four-out": "First 4 Out",
  "next-four-out": "Next 4 Out",
  conference: "Conference",
};

function reasonLabel(row: Pick<ContentionCandidate, "reasons" | "conferenceGap">, reason: ContentionReason): string {
  if (reason !== "conference") return REASON_LABEL[reason];
  if (row.conferenceGap == null) return "Conference";
  if (row.conferenceGap <= 0.05) return "Conf. leader";
  return `Conf. +${formatRank(row.conferenceGap, 1)}`;
}

function MoveCard({
  team,
  move,
  candidate,
  metrics,
  onApprove,
}: {
  team: CbbTeam;
  move: ContentionMove;
  candidate?: ContentionCandidate;
  metrics: Map<string, CbbTeamMetrics>;
  onApprove: () => void;
}) {
  const reasons = (candidate?.reasons.length ? candidate.reasons : move.reasons).map((reason) =>
    reasonLabel({ reasons: candidate?.reasons ?? move.reasons, conferenceGap: candidate?.conferenceGap ?? null }, reason),
  );
  return (
    <li className={`cbb-cont-move is-${move.kind}`}>
      <TeamLogo team={team} />
      <span className="cbb-cont-move-body">
        <strong>{team.shortName}</strong>
        <em>
          {shortCbbConference(team.conference)} · {formatRecord(team.wins, team.losses)} ·{" "}
          {formatRank(overallAverage(metrics.get(team.id)), 1)}
          {reasons.length ? ` · ${reasons.join(" · ")}` : ""}
        </em>
      </span>
      <button type="button" className={move.kind === "add" ? "primary-btn" : "ghost-btn"} onClick={onApprove}>
        {move.kind === "add" ? "Add" : "Drop"}
      </button>
    </li>
  );
}

export function ContentionTab({ teams, metrics, snapshot, approvedIds, onApprovedIds }: Props) {
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const candidates = useMemo(
    () => contentionCandidates(teams, metrics, snapshot),
    [teams, metrics, snapshot],
  );
  const candidateIds = useMemo(() => candidates.map((row) => row.teamId), [candidates]);
  const candidateKey = candidateIds.join(",");

  useEffect(() => {
    if (approvedIds != null || !candidateIds.length) return;
    onApprovedIds(candidateIds);
  }, [approvedIds, candidateKey, candidateIds, onApprovedIds]);

  const rosterIds = useMemo(
    () => contentionRosterIds(candidateIds, approvedIds),
    [candidateIds, approvedIds],
  );
  const byCandidate = useMemo(
    () => new Map(candidates.map((row) => [row.teamId, row])),
    [candidates],
  );
  const moves = useMemo(
    () => withCandidateReasons(contentionMoves(candidateIds, approvedIds), candidates),
    [candidateIds, approvedIds, candidates],
  );
  const adds = moves.filter((move) => move.kind === "add");
  const drops = moves.filter((move) => move.kind === "drop");
  const dropIds = useMemo(() => new Set(drops.map((move) => move.teamId)), [drops]);
  const roster = useMemo(() => {
    const rows = rosterIds
      .filter((id) => teamsById.has(id))
      .map((id) => {
        const existing = byCandidate.get(id);
        if (existing) return existing;
        return {
          teamId: id,
          reasons: [] as ContentionReason[],
          average: overallAverage(metrics.get(id)),
          conferenceGap: null,
          conferenceLeaderId: null,
        };
      });
    return rows.sort((left, right) => {
      if (left.average != null && right.average != null && left.average !== right.average) {
        return left.average - right.average;
      }
      if (left.average != null && right.average == null) return -1;
      if (left.average == null && right.average != null) return 1;
      return 0;
    });
  }, [rosterIds, byCandidate, metrics, teamsById]);

  const approve = (move: ContentionMove) => {
    onApprovedIds(applyContentionMove(approvedIds ?? candidateIds, move));
  };
  const approveKind = (kind: ContentionMove["kind"]) => {
    const batch = moves.filter((move) => move.kind === kind);
    if (!batch.length) return;
    onApprovedIds(applyContentionMoves(approvedIds ?? candidateIds, batch));
  };

  return (
    <div className="cbb-contention">
      <section className="panel cbb-results-bar">
        <header className="panel-header">
          <p className="eyebrow">In Contention</p>
          <h2>{snapshot ? snapshot.label : "No projection yet"}</h2>
          <p>
            Last projection field, First 4 Out, Next 4 Out, and any team within {CONTENTION_WITHIN}{" "}
            of its conference leader&apos;s six-rank average
            {roster.length ? ` · ${roster.length} teams` : ""}
          </p>
        </header>
      </section>

      {adds.length || drops.length ? (
        <section className="panel cbb-cont-queue" aria-label="Approve contention moves">
          <header className="panel-header">
            <p className="eyebrow">Approve moves</p>
            <h2>
              {adds.length} new · {drops.length} eliminated
            </h2>
            <p>Each team stays put until you add or drop it.</p>
          </header>
          {adds.length ? (
            <div className="cbb-cont-batch">
              <div className="cbb-cont-batch-head">
                <h3>New to contention</h3>
                <button type="button" className="ghost-btn" onClick={() => approveKind("add")}>
                  Add all
                </button>
              </div>
              <ol>
                {adds.map((move) => {
                  const team = teamsById.get(move.teamId);
                  if (!team) return null;
                  return (
                    <MoveCard
                      key={`add-${move.teamId}`}
                      team={team}
                      move={move}
                      candidate={byCandidate.get(move.teamId)}
                      metrics={metrics}
                      onApprove={() => approve(move)}
                    />
                  );
                })}
              </ol>
            </div>
          ) : null}
          {drops.length ? (
            <div className="cbb-cont-batch">
              <div className="cbb-cont-batch-head">
                <h3>Eliminated</h3>
                <button type="button" className="ghost-btn" onClick={() => approveKind("drop")}>
                  Drop all
                </button>
              </div>
              <ol>
                {drops.map((move) => {
                  const team = teamsById.get(move.teamId);
                  if (!team) return null;
                  return (
                    <MoveCard
                      key={`drop-${move.teamId}`}
                      team={team}
                      move={move}
                      candidate={byCandidate.get(move.teamId)}
                      metrics={metrics}
                      onApprove={() => approve(move)}
                    />
                  );
                })}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      {!snapshot ? (
        <p className="cbb-cont-note">
          Save a Bracketology projection to include the field, First 4 Out, and Next 4 Out. Conference
          teams within {CONTENTION_WITHIN} of their leader are listed either way.
        </p>
      ) : null}

      {roster.length ? (
        <ol className="cbb-scurve cbb-cont-list">
          {roster.map((row, index) => {
            const team = teamsById.get(row.teamId);
            if (!team) return null;
            return (
              <li key={row.teamId}>
                <div
                  className={`cbb-scurve-row cbb-cont-row${row.reasons.includes("field") ? " at-large" : ""}${
                    row.reasons.includes("first-four-out") || row.reasons.includes("next-four-out")
                      ? " bubble"
                      : ""
                  }${dropIds.has(row.teamId) ? " is-pending-drop" : ""}`}
                >
                  <span className="cbb-scurve-rank">{index + 1}</span>
                  <TeamLogo team={team} />
                  <strong>{team.shortName}</strong>
                  <span className="cbb-scurve-meta">{shortCbbConference(team.conference)}</span>
                  <span className="cbb-scurve-meta">{formatRecord(team.wins, team.losses)}</span>
                  <span className="cbb-scurve-avg">{formatRank(row.average, 1)}</span>
                  <span className="cbb-cont-reasons">
                    {dropIds.has(row.teamId) ? <em>Pending drop</em> : null}
                    {row.reasons.map((reason) => (
                      <em key={reason}>{reasonLabel(row, reason)}</em>
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="cbb-cont-note">No teams in contention yet.</p>
      )}
    </div>
  );
}
