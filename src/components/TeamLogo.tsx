"use client";

import { logoSwatch } from "@/lib/team-colors";

export type TeamLogoSource = {
  logo?: string | null;
  abbreviation?: string;
  color?: string | null;
  alternateColor?: string | null;
};

type Props = {
  team: TeamLogoSource;
  className?: string;
  fallback?: string;
};

export function TeamLogo({ team, className = "", fallback }: Props) {
  const swatch = logoSwatch(team.color, team.alternateColor);
  const classes = ["team-logo", className].filter(Boolean).join(" ");
  const mark = fallback ?? team.abbreviation?.slice(0, 2) ?? "·";

  if (team.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={team.logo} alt="" className={classes} style={swatch} />
    );
  }

  return (
    <span className={`${classes} team-logo-fallback`} style={swatch} aria-hidden>
      {mark}
    </span>
  );
}
