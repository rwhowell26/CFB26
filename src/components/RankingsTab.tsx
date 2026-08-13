"use client";

import { playoffBidCount } from "@/lib/playoff";
import { teamsIn, tiersInRegion } from "@/lib/rankings";
import { PLAYOFF_TIERS, REGIONS, recordLabel, tierName, winPct } from "@/lib/teams";
import type { Assignment, SeasonSim } from "@/lib/types";

export function RankingsTab({
  assignment,
  season,
}: {
  assignment: Assignment;
  season: SeasonSim;
}) {
  return (
    <div className="stack">
      <p className="lede">
        2026 simulated standings inside each 8-team tier. Ole Miss wins every game.
        LSU loses every game. Other results follow 2025 SP+. Autobids: top 3 in
        Tier I, top 2 in Tier II, champion of Tier III. These lists also drive
        promotion games and crossovers.
      </p>
      <div className="region-grid">
        {REGIONS.map((region) => {
          const tiers = tiersInRegion(assignment, region.id);
          return (
            <article key={region.id} className="panel" style={{ ["--accent" as string]: region.accent }}>
              <header className="panel-head">
                <h2>{region.name}</h2>
                <span>{tiers.length} tiers</span>
              </header>
              {tiers.map((tier) => {
                const ranked = teamsIn(assignment, region.id, tier, season.records);
                return (
                  <section key={tier} className="rank-tier">
                    <header>
                      <h3>{tierName(tier)}</h3>
                      <span>
                        {ranked.length} teams
                        {tier <= PLAYOFF_TIERS ? " · playoff" : " · promotion only"}
                      </span>
                    </header>
                    <ol className="rank-list">
                      {ranked.map((team, index) => {
                        const playoff = index < playoffBidCount(tier);
                        return (
                          <li key={team.id}>
                            <span className="rank-num">{index + 1}</span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={team.logo} alt="" width={26} height={26} />
                            <div className="rank-copy">
                              <strong>{team.shortName}</strong>
                              <em>
                                {playoff ? "Autobid · " : ""}
                                {Math.round(winPct(team) * 1000) / 10}%
                              </em>
                            </div>
                            <b>{recordLabel(team)}</b>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
            </article>
          );
        })}
      </div>
    </div>
  );
}
