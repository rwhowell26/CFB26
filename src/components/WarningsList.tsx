"use client";

import type { MoveSuggestion, PhilosophyWarning } from "@/lib/types";

type Props = {
  suggestions: MoveSuggestion[];
  warnings: PhilosophyWarning[];
  onApply: (suggestion: MoveSuggestion) => void;
  onSelectTeam?: (teamId: string) => void;
};

export function WarningsList({ suggestions, warnings, onApply, onSelectTeam }: Props) {
  const ahead = suggestions.filter((s) => s.type === "ahead_after_loss");
  const behind = suggestions.filter((s) => s.type === "behind_after_win");
  const undefeated = warnings.filter((w) => w.type === "undefeated_behind_loss");
  const winless = warnings.filter((w) => w.type === "winless_not_bottom");

  if (!suggestions.length && !undefeated.length && !winless.length) {
    return (
      <div className="warnings ok">
        No auto-suggest flags — nobody is ahead of a team they lost to or behind a team they
        beat on the current ballot.
      </div>
    );
  }

  return (
    <div className="warnings">
      <h3>Auto-suggest moves</h3>
      <p className="warnings-intro">
        Flags head-to-head conflicts with your ballot. Apply puts the winner directly above the
        loser.
      </p>

      {ahead.length ? (
        <div className="warn-block">
          <h4>Ahead after a loss ({ahead.length})</h4>
          <ul className="suggest-list">
            {ahead.slice(0, 16).map((s) => (
              <li key={s.id} className="suggest-row">
                <button
                  type="button"
                  className="suggest-msg"
                  onClick={() => onSelectTeam?.(s.teamId)}
                >
                  {s.message}
                </button>
                <button type="button" className="primary-btn suggest-apply" onClick={() => onApply(s)}>
                  {s.actionLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {behind.length ? (
        <div className="warn-block">
          <h4>Behind after a win ({behind.length})</h4>
          <ul className="suggest-list">
            {behind.slice(0, 16).map((s) => (
              <li key={s.id} className="suggest-row">
                <button
                  type="button"
                  className="suggest-msg"
                  onClick={() => onSelectTeam?.(s.teamId)}
                >
                  {s.message}
                </button>
                <button type="button" className="primary-btn suggest-apply" onClick={() => onApply(s)}>
                  {s.actionLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {undefeated.length ? (
        <div className="warn-block">
          <h4>Also: undefeated behind a loss ({undefeated.length})</h4>
          <ul>
            {undefeated.slice(0, 8).map((w, i) => (
              <li key={`${w.teamId}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {winless.length ? (
        <div className="warn-block">
          <h4>Also: winless above a winner ({winless.length})</h4>
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
