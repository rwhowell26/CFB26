"use client";

import type { PhilosophyWarning } from "@/lib/types";

export function WarningsList({ warnings }: { warnings: PhilosophyWarning[] }) {
  if (!warnings.length) {
    return (
      <div className="warnings ok">
        No philosophy flags on the current ballot (based on games played so far).
      </div>
    );
  }

  const lostTo = warnings.filter((w) => w.type === "lost_to_higher");
  const undefeated = warnings.filter((w) => w.type === "undefeated_behind_loss");
  const winless = warnings.filter((w) => w.type === "winless_not_bottom");

  return (
    <div className="warnings">
      <h3>Philosophy checks</h3>
      <p className="warnings-intro">
        Wins rule the board: usually sit behind teams you lost to; undefeated teams rarely trail
        teams with losses; winless teams sink.
      </p>
      {lostTo.length ? (
        <div className="warn-block">
          <h4>Ranked ahead after a loss ({lostTo.length})</h4>
          <ul>
            {lostTo.slice(0, 12).map((w, i) => (
              <li key={`${w.teamId}-${w.relatedTeamId}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {undefeated.length ? (
        <div className="warn-block">
          <h4>Undefeated behind a loss ({undefeated.length})</h4>
          <ul>
            {undefeated.slice(0, 8).map((w, i) => (
              <li key={`${w.teamId}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {winless.length ? (
        <div className="warn-block">
          <h4>Winless above a winner ({winless.length})</h4>
          <ul>
            {winless.slice(0, 8).map((w, i) => (
              <li key={`${w.teamId}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
