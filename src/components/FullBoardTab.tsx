"use client";

import type { Team } from "@/lib/types";

type Props = {
  teamsById: Map<string, Team>;
  rankedIds: string[];
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
};

export function FullBoardTab({
  teamsById,
  rankedIds,
  onSelectTeam,
  selectedTeamId,
}: Props) {
  if (!rankedIds.length) {
    return (
      <div className="empty-state panel">
        No teams ranked yet. Build your ballot on the Rank tab, then come back for the full board.
      </div>
    );
  }

  return (
    <section className="panel full-board-panel">
      <header className="panel-header">
        <h2>Full board</h2>
        <p>
          {rankedIds.length} team{rankedIds.length === 1 ? "" : "s"} · rank + logo
        </p>
      </header>
      <ol className="full-board">
        {rankedIds.map((id, index) => {
          const team = teamsById.get(id);
          if (!team) return null;
          const rank = index + 1;
          const selected = selectedTeamId === id;
          return (
            <li key={id}>
              <button
                type="button"
                className={`full-board-cell ${selected ? "selected" : ""}`}
                onClick={() => onSelectTeam?.(id)}
                title={`${rank}. ${team.name}`}
                aria-label={`Rank ${rank}, ${team.name}`}
              >
                <span className="full-board-rank">{rank}</span>
                {team.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={team.logo} alt="" className="full-board-logo" />
                ) : (
                  <span className="team-logo-fallback full-board-logo" aria-hidden>
                    {team.abbreviation.slice(0, 3)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
