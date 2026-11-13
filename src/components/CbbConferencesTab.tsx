"use client";

import { useMemo, useState } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { rankCbbConferences } from "@/lib/cbb-conference-rank";
import { formatRank, formatRecord, overallAverage } from "@/lib/cbb-metrics";
import type { CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

type Props = {
  teams: CbbTeam[];
  metrics: Map<string, CbbTeamMetrics>;
};

export function CbbConferencesTab({ teams, metrics }: Props) {
  const [openName, setOpenName] = useState<string | null>(null);
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const rows = useMemo(
    () => rankCbbConferences(teams, teamsById, metrics),
    [teams, teamsById, metrics],
  );

  return (
    <div className="cbb-conferences">
      <section className="panel cbb-results-bar">
        <header className="panel-header">
          <p className="eyebrow">Conferences</p>
          <h2>Six-rank average</h2>
          <p>
            {rows.length} conferences · ranked by the mean of each team&apos;s SOR, KPI, WAB,
            KenPom, BPI, and Torvik ranks · lower is stronger
          </p>
        </header>
      </section>

      <ol className="cbb-scurve cbb-conf-list">
        {rows.map((row) => {
          const best = row.bestTeamId ? teamsById.get(row.bestTeamId) : null;
          const open = openName === row.name;
          return (
            <li key={row.name}>
              <button
                type="button"
                className={`cbb-scurve-row cbb-conf-row${open ? " is-open" : ""}`}
                onClick={() => setOpenName(open ? null : row.name)}
                aria-expanded={open}
              >
                <span className="cbb-scurve-rank">{row.rank}</span>
                {best ? <TeamLogo team={best} /> : <span className="cbb-conf-logo-gap" />}
                <span className="cbb-conf-name">
                  <strong>{row.shortName}</strong>
                  <em>
                    {row.rankedCount}/{row.teamCount} teams
                    {best ? ` · ${best.shortName}` : ""}
                  </em>
                </span>
                <span className="cbb-scurve-avg">{formatRank(row.average, 1)}</span>
              </button>
              {open ? (
                <ol className="cbb-conf-teams">
                  {row.teamIds.map((teamId, index) => {
                    const team = teamsById.get(teamId);
                    if (!team) return null;
                    return (
                      <li key={teamId} className="cbb-scurve-row cbb-conf-team">
                        <span className="cbb-scurve-rank">{index + 1}</span>
                        <TeamLogo team={team} />
                        <strong>{team.shortName}</strong>
                        <span className="cbb-scurve-meta">{formatRecord(team.wins, team.losses)}</span>
                        <span className="cbb-scurve-avg">{formatRank(overallAverage(metrics.get(teamId)), 1)}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
