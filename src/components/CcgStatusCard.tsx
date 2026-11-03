"use client";

import {
  CCG_STATUS_LABEL,
  contentionCopy,
  type CcgStatus,
  type CcgTeamContention,
  type CcgWeekSwing,
} from "@/lib/ccg-contention";
import type { Team } from "@/lib/types";

export function CcgStatusChip({ status }: { status: CcgStatus }) {
  return <span className={`ccg-chip ${status}`}>{CCG_STATUS_LABEL[status]}</span>;
}

export function CcgStatusCard({
  team,
  row,
  weekSwings,
  teamsById,
}: {
  team: Team;
  row: CcgTeamContention;
  weekSwings: CcgWeekSwing[];
  teamsById: Map<string, Team>;
}) {
  const name = team.shortName;
  const uniqueGames = new Map<string, CcgWeekSwing[]>();
  for (const item of weekSwings) {
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
        <p className="ccg-muted">No remaining conference games this week would clinch or eliminate them.</p>
      ) : (
        <ul className="ccg-elim-list">
          {[...uniqueGames.values()].map((items) => {
            const game = items[0]!.game;
            const home = teamsById.get(game.homeTeamId)?.shortName ?? game.homeName;
            const away = teamsById.get(game.awayTeamId)?.shortName ?? game.awayName;
            const bits = items.map((item) => {
              const winner = teamsById.get(item.winnerId)?.shortName ?? item.winnerId;
              return item.kind === "clinches"
                ? `${winner} winning clinches a CCG berth`
                : `${winner} winning eliminates ${name}`;
            });
            return (
              <li key={game.id}>
                <strong>
                  {away} @ {home}
                </strong>
                {bits.length ? ` — ${bits.join("; ")}` : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
