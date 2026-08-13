"use client";

import { REGIONS, TIER_META, recordLabel, winPct } from "@/lib/teams";
import { teamsIn } from "@/lib/rankings";
import type { Assignment, TierId } from "@/lib/types";

export function RankingsTab({ assignment }: { assignment: Assignment }) {
  return (
    <div className="stack">
      <p className="lede">
        Regional standings from last season (2025 overall record, then wins, then point
        differential). These standings drive inter-region matchups and the playoff field.
        Moving a team on the Regions tab changes which list they appear on, not their 2025 record.
      </p>
      <div className="region-grid">
        {REGIONS.map((region) => {
          const ranked = teamsIn(assignment, region.id);
          return (
            <article key={region.id} className="panel" style={{ ["--accent" as string]: region.accent }}>
              <header className="panel-head">
                <h2>{region.name}</h2>
                <span>{ranked.length} teams</span>
              </header>
              <ol className="rank-list">
                {ranked.map((team, index) => {
                  const place = assignment[team.id];
                  return (
                    <li key={team.id}>
                      <span className="rank-num">{index + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={team.logo} alt="" width={26} height={26} />
                      <div className="rank-copy">
                        <strong>{team.shortName}</strong>
                        <em>
                          {TIER_META[place.tier as TierId].name} · {Math.round(winPct(team) * 1000) / 10}%
                        </em>
                      </div>
                      <b>{recordLabel(team)}</b>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </div>
    </div>
  );
}
