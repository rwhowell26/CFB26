"use client";

import {
  CCG_STATUS_LABEL,
  contentionCopy,
  type CcgElimGame,
  type CcgStatus,
  type CcgTeamContention,
} from "@/lib/ccg-contention";
import type { Team } from "@/lib/types";

export function CcgStatusChip({ status }: { status: CcgStatus }) {
  return <span className={`ccg-chip ${status}`}>{CCG_STATUS_LABEL[status]}</span>;
}

export function CcgStatusCard({
  team,
  row,
  elimGames,
  teamsById,
}: {
  team: Team;
  row: CcgTeamContention;
  elimGames: CcgElimGame[];
  teamsById: Map<string, Team>;
}) {
  const name = team.shortName;
  const uniqueGames = new Map<string, CcgElimGame[]>();
  for (const item of elimGames) {
    const list = uniqueGames.get(item.game.id) ?? [];
    list.push(item);
    uniqueGames.set(item.game.id, list);
  }
  return (
    <section className={`panel ccg-card ${row.status}`}>
      <header className="ccg-card-head">
        <h2>{name}</h2>
        <CcgStatusChip status={row.status} />
      </header>
      <p>{contentionCopy(row, name)}</p>
      {row.status === "eliminated" ? null : uniqueGames.size === 0 ? (
        <p className="ccg-muted">No remaining conference games this week would eliminate them.</p>
      ) : (
        <ul className="ccg-elim-list">
          {[...uniqueGames.values()].map((items) => {
            const game = items[0]!.game;
            const home = teamsById.get(game.homeTeamId)?.shortName ?? game.homeName;
            const away = teamsById.get(game.awayTeamId)?.shortName ?? game.awayName;
            const winners = items.map((item) => {
              const id = item.eliminatesIf.winnerId;
              return teamsById.get(id)?.shortName ?? id;
            });
            return (
              <li key={game.id}>
                <strong>
                  {away} @ {home}
                </strong>
                {winners.length
                  ? ` — ${winners.join(" or ")} winning eliminates ${name}`
                  : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
