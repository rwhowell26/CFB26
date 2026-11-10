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
import type { CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

type Props = {
  left: CbbTeam;
  right: CbbTeam;
  leftMetrics: CbbTeamMetrics;
  rightMetrics: CbbTeamMetrics;
  leftRole: string;
  rightRole: string;
  leftRank: number;
  rightRank: number;
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

export function CbbCompareCard({
  left,
  right,
  leftMetrics,
  rightMetrics,
  leftRole,
  rightRole,
  leftRank,
  rightRank,
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
      <button type="button" className="cbb-compare-col" style={leftColors} onClick={onPickLeft}>
        <header className="cbb-compare-head">
          <p className="cbb-compare-role">{leftRole}</p>
          <TeamLogo team={left} className="lg" onFill={leftColors.background} />
          <strong>
            #{leftRank} {left.shortName}
          </strong>
          <p>{formatRecord(left.wins, left.losses)}</p>
        </header>
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
        <p className="cbb-compare-hint">Click to rank {left.shortName} higher</p>
      </button>

      <div className="cbb-compare-mid">
        <div className="cbb-compare-mid-head">
          <span className="cbb-compare-gap" style={badgeColors ?? undefined}>
            {badgeText}
          </span>
        </div>
        {rows.map((row) => (
          <span key={row.key} className={`cbb-compare-label${row.avg ? " avg" : ""}`}>
            {row.label}
          </span>
        ))}
        <div className="cbb-compare-mid-spacer" />
        <div className="cbb-compare-mid-spacer" />
      </div>

      <button type="button" className="cbb-compare-col" style={rightColors} onClick={onPickRight}>
        <header className="cbb-compare-head">
          <p className="cbb-compare-role">{rightRole}</p>
          <TeamLogo team={right} className="lg" onFill={rightColors.background} />
          <strong>
            #{rightRank} {right.shortName}
          </strong>
          <p>{formatRecord(right.wins, right.losses)}</p>
        </header>
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
        <p className="cbb-compare-hint">Click to rank {right.shortName} higher</p>
      </button>
    </div>
  );
}
