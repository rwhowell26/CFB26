"use client";

import { TeamLogo } from "@/components/TeamLogo";
import { shortCbbConference } from "@/lib/cbb-conferences";
import {
  formatDiff,
  formatQuad,
  formatRankValue,
  formatRecord,
  predictiveAverage,
  rankDiff,
  resumeAverage,
} from "@/lib/cbb-metrics";
import type { CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

type Props = {
  team: CbbTeam;
  metrics: CbbTeamMetrics;
  other: CbbTeamMetrics;
  roleLabel: string;
  rank: number;
  onPick: () => void;
};

type MetricRow = {
  key: string;
  label: string;
  left: number | null;
  right: number | null;
  avg?: boolean;
};

function MetricStack({
  rows,
  title,
}: {
  rows: MetricRow[];
  title: string;
}) {
  return (
    <div className="cbb-metric-group">
      <p className="cbb-metric-group-label">{title}</p>
      <dl>
        {rows.map((row) => {
          const diff = rankDiff(row.left, row.right);
          const better = diff != null && diff < 0;
          const worse = diff != null && diff > 0;
          return (
            <div
              key={row.key}
              className={`cbb-metric-row${row.avg ? " avg" : ""}${better ? " better" : ""}${worse ? " worse" : ""}`}
            >
              <dt>{row.label}</dt>
              <dd className="cbb-metric-value">{formatRankValue(row.left, row.avg ? 1 : 0)}</dd>
              <dd className="cbb-metric-diff">{formatDiff(diff)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function CbbCompareCard({ team, metrics, other, roleLabel, rank, onPick }: Props) {
  const resumeRows: MetricRow[] = [
    { key: "resume", label: "Average", left: resumeAverage(metrics), right: resumeAverage(other), avg: true },
    { key: "sor", label: "SOR", left: metrics.sor, right: other.sor },
    { key: "kpi", label: "KPI", left: metrics.kpi, right: other.kpi },
    { key: "wab", label: "WAB", left: metrics.wab, right: other.wab },
  ];
  const predRows: MetricRow[] = [
    {
      key: "pred",
      label: "Average",
      left: predictiveAverage(metrics),
      right: predictiveAverage(other),
      avg: true,
    },
    { key: "kenpom", label: "KenPom", left: metrics.kenpom, right: other.kenpom },
    { key: "bpi", label: "BPI", left: metrics.bpi, right: other.bpi },
    { key: "torvik", label: "Torvik", left: metrics.torvik, right: other.torvik },
  ];

  return (
    <button type="button" className="cbb-compare-card" onClick={onPick}>
      <header>
        <p className="cbb-compare-role">{roleLabel}</p>
        <div className="cbb-compare-team">
          <TeamLogo team={team} />
          <div>
            <strong>
              #{rank} {team.shortName}
            </strong>
            <p>
              {formatRecord(team.wins, team.losses)} · {shortCbbConference(team.conference)}
            </p>
          </div>
        </div>
      </header>
      <MetricStack title="Resume" rows={resumeRows} />
      <MetricStack title="Predictive" rows={predRows} />
      <div className="cbb-quads">
        <span>Q1 {formatQuad(metrics.quad1)}</span>
        <span>Q2 {formatQuad(metrics.quad2)}</span>
        <span>Q3 {formatQuad(metrics.quad3)}</span>
        <span>Q4 {formatQuad(metrics.quad4)}</span>
      </div>
      <p className="cbb-compare-hint">Click to rank {team.shortName} higher</p>
    </button>
  );
}
