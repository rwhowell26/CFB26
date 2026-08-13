"use client";

import { useMemo, type ReactNode } from "react";
import { getTeam } from "@/lib/teams";
import type { Team } from "@/lib/types";

export function TeamChip({
  team,
  extra,
  compact = false,
}: {
  team: Team | string;
  extra?: string;
  compact?: boolean;
}) {
  const resolved = typeof team === "string" ? getTeam(team) : team;
  return (
    <span className={`chip ${compact ? "chip-compact" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resolved.logo} alt="" width={22} height={22} />
      <span className="chip-copy">
        <strong>
          {resolved.shortName}
        </strong>
        {extra ? <em>{extra}</em> : null}
      </span>
    </span>
  );
}

export function TeamRow({
  team,
  trailing,
  onClick,
  active = false,
}: {
  team: Team;
  trailing?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const record = `${team.wins}-${team.losses}`;
  return (
    <button
      type="button"
      className={`team-row ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.logo} alt="" width={28} height={28} />
      <span className="team-row-copy">
        <strong>{team.shortName}</strong>
        <em>{team.abbreviation}</em>
      </span>
      <span className="team-row-record">{record}</span>
      {trailing}
    </button>
  );
}

export function useTeamSearch(teams: Team[], query: string) {
  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((team) =>
      `${team.name} ${team.shortName} ${team.abbreviation} ${team.state}`
        .toLowerCase()
        .includes(needle),
    );
  }, [teams, query]);
}
