"use client";

import { TeamLogo } from "@/components/TeamLogo";
import {
  formatQuad,
  formatRank,
  formatRankAdvantage,
  formatRecord,
  overallAverage,
  predictiveAverage,
  rankAdvantage,
  resumeAverage,
} from "@/lib/cbb-metrics";
import { compareColumnColors } from "@/lib/team-colors";
import { shortCbbConference } from "@/lib/cbb-conferences";
import type { CbbFieldTeam, CbbTeam, CbbTeamMetrics, CbbTeamSpot } from "@/lib/cbb-types";
import { spotLabel } from "@/lib/cbb-bracket";

type Props = {
  left: CbbTeam;
  right: CbbTeam;
  leftMetrics: CbbTeamMetrics;
  rightMetrics: CbbTeamMetrics;
  leftRole: string;
  rightRole: string;
  leftSpot: CbbTeamSpot;
  rightSpot: CbbTeamSpot;
  leftMates: CbbFieldTeam[];
  rightMates: CbbFieldTeam[];
  teamsById: Map<string, CbbTeam>;
  onPickLeft: () => void;
  onPickRight: () => void;
};

type MetricRow = {
  key: string;
  label: string;
  left: number | null;
  right: number | null;
  avg?: boolean;
};

function sideClass(self: number | null, other: number | null): string {
  const advantage = rankAdvantage(self, other);
  if (advantage == null || Math.abs(advantage) < 0.05) return "";
  return advantage > 0 ? " better" : " worse";
}

function ContentionList({
  team,
  mates,
  teamsById,
  align,
}: {
  team: CbbTeam;
  mates: CbbFieldTeam[];
  teamsById: Map<string, CbbTeam>;
  align: "left" | "right";
}) {
  const conf = shortCbbConference(team.conference);
  return (
    <div className={`cbb-contention-col ${align}`}>
      <p>
        {conf} · {mates.length} in
      </p>
      {mates.length ? (
        <ol>
          {mates.map((row) => {
            const mate = teamsById.get(row.teamId);
            if (!mate) return null;
            const current = mate.id === team.id;
            return (
              <li key={row.teamId} className={current ? "is-current" : undefined}>
                <span>{row.seed}</span>
                <TeamLogo team={mate} />
                <strong>{mate.shortName}</strong>
                <em>{row.role === "auto-bid" ? "AQ" : "AL"}</em>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="cbb-contention-empty">None in yet</p>
      )}
    </div>
  );
}

export function CbbCompareCard({
  left,
  right,
  leftMetrics,
  rightMetrics,
  leftRole,
  rightRole,
  leftSpot,
  rightSpot,
  leftMates,
  rightMates,
  teamsById,
  onPickLeft,
  onPickRight,
}: Props) {
  const leftColors = compareColumnColors(left.color, left.alternateColor);
  const rightColors = compareColumnColors(right.color, right.alternateColor);
  const leftOverall = overallAverage(leftMetrics);
  const rightOverall = overallAverage(rightMetrics);
  const leftAdv = rankAdvantage(leftOverall, rightOverall);
  const betterSide =
    leftAdv == null || Math.abs(leftAdv) < 0.05 ? null : leftAdv > 0 ? "left" : "right";
  const badgeColors = betterSide === "left" ? leftColors : betterSide === "right" ? rightColors : null;
  const badgeText = formatRankAdvantage(leftAdv == null ? null : Math.abs(leftAdv) < 0.05 ? 0 : Math.abs(leftAdv));

  const rows: MetricRow[] = [
    { key: "overall", label: "Overall", left: leftOverall, right: rightOverall, avg: true },
    { key: "resume", label: "Resume", left: resumeAverage(leftMetrics), right: resumeAverage(rightMetrics), avg: true },
    { key: "sor", label: "SOR", left: leftMetrics.sor, right: rightMetrics.sor },
    { key: "kpi", label: "KPI", left: leftMetrics.kpi, right: rightMetrics.kpi },
    { key: "wab", label: "WAB", left: leftMetrics.wab, right: rightMetrics.wab },
    {
      key: "pred",
      label: "Predictive",
      left: predictiveAverage(leftMetrics),
      right: predictiveAverage(rightMetrics),
      avg: true,
    },
    { key: "kenpom", label: "KenPom", left: leftMetrics.kenpom, right: rightMetrics.kenpom },
    { key: "bpi", label: "BPI", left: leftMetrics.bpi, right: rightMetrics.bpi },
    { key: "torvik", label: "Torvik", left: leftMetrics.torvik, right: rightMetrics.torvik },
  ];

  return (
    <div className="cbb-compare-board">
      <button type="button" className="cbb-compare-col left" style={leftColors} onClick={onPickLeft}>
        <header className="cbb-compare-head">
          <p className="cbb-compare-role">{leftRole}</p>
          <p className="cbb-compare-seedline" aria-label={`${spotLabel(leftSpot)}, rank ${leftSpot.rank}`}>
            <span className="cbb-compare-seed">{leftSpot.seed != null ? `${leftSpot.seed}` : "—"}</span>
            <span className="cbb-compare-seed-meta">
              <strong>{spotLabel(leftSpot)}</strong>
              <em>#{leftSpot.rank}</em>
            </span>
          </p>
          <TeamLogo team={left} className="lg" onFill={leftColors.background} />
          <strong>{left.shortName}</strong>
          <p>{formatRecord(left.wins, left.losses)}</p>
        </header>
        <span className="cbb-compare-val-spacer" aria-hidden>
          &nbsp;
        </span>
        {rows.map((row) => (
          <span
            key={row.key}
            className={`cbb-compare-val${row.avg ? " avg" : ""}${sideClass(row.left, row.right)}`}
          >
            {formatRank(row.left, row.avg ? 1 : 0)}
          </span>
        ))}
        <div className="cbb-quads">
          <span>Q1 {formatQuad(leftMetrics.quad1)}</span>
          <span>Q2 {formatQuad(leftMetrics.quad2)}</span>
          <span>Q3 {formatQuad(leftMetrics.quad3)}</span>
          <span>Q4 {formatQuad(leftMetrics.quad4)}</span>
        </div>
      </button>

      <div className="cbb-compare-mid">
        <div
          className={`cbb-compare-mid-head${betterSide ? ` toward-${betterSide}` : ""}`}
          role="img"
          aria-label={
            betterSide === "left"
              ? `${left.shortName} leads by ${badgeText}`
              : betterSide === "right"
                ? `${right.shortName} leads by ${badgeText}`
                : "Overall ranks are even"
          }
        >
          {betterSide === "left" ? (
            <span className="cbb-compare-arrow" aria-hidden>
              ⬅
            </span>
          ) : null}
          <span className="cbb-compare-gap" style={badgeColors ?? undefined}>
            {badgeText}
          </span>
          {betterSide === "right" ? (
            <span className="cbb-compare-arrow" aria-hidden>
              ➡
            </span>
          ) : null}
        </div>
        {rows.map((row) => (
          <span key={row.key} className={`cbb-compare-label${row.avg ? " avg" : ""}`}>
            {row.label}
          </span>
        ))}
        <div className="cbb-contention">
          {left.conference === right.conference ? (
            <ContentionList team={left} mates={leftMates} teamsById={teamsById} align="left" />
          ) : (
            <>
              <ContentionList team={left} mates={leftMates} teamsById={teamsById} align="left" />
              <ContentionList team={right} mates={rightMates} teamsById={teamsById} align="right" />
            </>
          )}
        </div>
      </div>

      <button type="button" className="cbb-compare-col right" style={rightColors} onClick={onPickRight}>
        <header className="cbb-compare-head">
          <p className="cbb-compare-role">{rightRole}</p>
          <p className="cbb-compare-seedline" aria-label={`${spotLabel(rightSpot)}, rank ${rightSpot.rank}`}>
            <span className="cbb-compare-seed">{rightSpot.seed != null ? `${rightSpot.seed}` : "—"}</span>
            <span className="cbb-compare-seed-meta">
              <strong>{spotLabel(rightSpot)}</strong>
              <em>#{rightSpot.rank}</em>
            </span>
          </p>
          <TeamLogo team={right} className="lg" onFill={rightColors.background} />
          <strong>{right.shortName}</strong>
          <p>{formatRecord(right.wins, right.losses)}</p>
        </header>
        <span className="cbb-compare-val-spacer" aria-hidden>
          &nbsp;
        </span>
        {rows.map((row) => (
          <span
            key={row.key}
            className={`cbb-compare-val${row.avg ? " avg" : ""}${sideClass(row.right, row.left)}`}
          >
            {formatRank(row.right, row.avg ? 1 : 0)}
          </span>
        ))}
        <div className="cbb-quads">
          <span>Q1 {formatQuad(rightMetrics.quad1)}</span>
          <span>Q2 {formatQuad(rightMetrics.quad2)}</span>
          <span>Q3 {formatQuad(rightMetrics.quad3)}</span>
          <span>Q4 {formatQuad(rightMetrics.quad4)}</span>
        </div>
      </button>
    </div>
  );
}
