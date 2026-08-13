"use client";

import { teamsIn, tiersInRegion } from "@/lib/rankings";
import { PLAYOFF_TIERS, REGIONS, recordLabel, tierName, winPct } from "@/lib/teams";
import type { Assignment } from "@/lib/types";

export function RankingsTab({ assignment }: { assignment: Assignment }) {
  return (
    <div className="stack">
      <p className="lede">
        Regional standings from the 2025 record. These drive playoff autobids, promotion
        games, and crossovers. Starting tiers on the Regions tab use 2021–2025 records.
      </p>
      <div className="region-grid">
        {REGIONS.map((region) => {
          const ranked = teamsIn(assignment, region.id);
          return (
            <article key={region.id} className="panel" style={{ ["--accent" as string]: region.accent }}>
              <header className="panel-head">
                <h2>{region.name}</h2>
                <span>{tiersInRegion(assignment, region.id).length} tiers</span>
              </header>
              <ol className="rank-list">
                {ranked.map((team, index) => {
                  const place = assignment[team.id];
                  const inGroup = teamsIn(assignment, region.id, place.tier);
                  const groupRank = inGroup.findIndex((item) => item.id === team.id) + 1;
                  const playoff = place.tier <= PLAYOFF_TIERS && groupRank <= 2;
                  return (
                    <li key={team.id}>
                      <span className="rank-num">{index + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={team.logo} alt="" width={26} height={26} />
                      <div className="rank-copy">
                        <strong>{team.shortName}</strong>
                        <em>
                          {tierName(place.tier)} #{groupRank}
                          {playoff ? " · autobid" : ""}
                          · {Math.round(winPct(team) * 1000) / 10}%
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
