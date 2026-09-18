"use client";

import { logoAppearance } from "@/lib/team-colors";

export type TeamLogoSource = {
  id?: string | null;
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
  const { src, style, markColor } = logoAppearance(
    team.color,
    team.alternateColor,
    team.logo,
    team.id,
  );
  const classes = ["team-logo", className].filter(Boolean).join(" ");
  const mark = fallback ?? team.abbreviation?.slice(0, 2) ?? "·";

  if (src && markColor) {
    return (
      <span className={classes} style={style} aria-hidden>
        <span
          className="team-logo-mark"
          style={{
            backgroundColor: markColor,
            WebkitMaskImage: `url("${src}")`,
            maskImage: `url("${src}")`,
          }}
        />
      </span>
    );
  }

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={classes} style={style} />
    );
  }

  return (
    <span className={`${classes} team-logo-fallback`} style={style} aria-hidden>
      {mark}
    </span>
  );
}
