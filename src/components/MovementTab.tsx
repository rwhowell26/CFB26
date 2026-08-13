"use client";

import { TeamChip } from "@/components/TeamChip";
import { applyMovement, planAllMovement } from "@/lib/promotion";
import { getTeam, regionName, tierName } from "@/lib/teams";
import type { Assignment } from "@/lib/types";

export function MovementTab({
  assignment,
  onApply,
}: {
  assignment: Assignment;
  onApply: (next: Assignment) => void;
}) {
  const plans = planAllMovement(assignment);
  const ready = plans.every((plan) => plan.complete);

  return (
    <div className="stack">
      <p className="lede">
        End-of-year movement uses last year’s standings as this season’s results. Champions
        always go up. Last place always goes down. Playoff teams from Tiers II and III also
        go up. Remaining bubble clubs play relegation games — at most three teams leave a
        tier in one direction. Apply writes the new map onto the Regions board.
      </p>
      <div className="top-actions" style={{ justifyItems: "start" }}>
        <button
          type="button"
          className="ghost"
          disabled={!ready}
          onClick={() => onApply(applyMovement(assignment))}
        >
          Apply offseason movement
        </button>
        {!ready ? <span className="footnote">Every displayed tier needs exactly 8 teams first.</span> : null}
      </div>
      <div className="region-grid">
        {plans.map((plan) => (
          <article key={plan.region} className="panel">
            <header className="panel-head">
              <h2>{regionName(plan.region)}</h2>
              <span>{plan.complete ? "Ready" : "Incomplete"}</span>
            </header>
            {plan.warning ? <p className="footnote">{plan.warning}</p> : null}
            <h3 className="section-title">Up</h3>
            <ul className="move-list">
              {plan.promotions.map((item) => (
                <li key={`${item.teamId}-up`}>
                  <TeamChip team={item.teamId} extra={`${tierName(item.fromTier)} → ${tierName(item.toTier)}`} />
                  <em>{item.detail}</em>
                </li>
              ))}
            </ul>
            <h3 className="section-title">Down</h3>
            <ul className="move-list">
              {plan.relegations.map((item) => (
                <li key={`${item.teamId}-down`}>
                  <TeamChip team={item.teamId} extra={`${tierName(item.fromTier)} → ${tierName(item.toTier)}`} />
                  <em>{item.detail}</em>
                </li>
              ))}
            </ul>
            <h3 className="section-title">Relegation games</h3>
            <ul className="move-list">
              {plan.games.map((game) => {
                const higher = getTeam(game.higherId);
                const lower = getTeam(game.lowerId);
                const winner = getTeam(game.projectedWinnerId);
                return (
                  <li key={`${game.higherId}-${game.lowerId}`}>
                    <TeamChip team={lower} extra={tierName(game.lowerTier)} />
                    <span>vs</span>
                    <TeamChip team={higher} extra={tierName(game.higherTier)} />
                    <em>
                      Projected: {winner.shortName}
                      {game.swaps ? " (swap)" : " (hold)"}
                    </em>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
