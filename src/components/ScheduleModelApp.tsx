"use client";

import { useMemo, useState } from "react";
import { BuilderTab } from "@/components/BuilderTab";
import { CalendarTab } from "@/components/CalendarTab";
import { MovementTab } from "@/components/MovementTab";
import { PlayoffTab } from "@/components/PlayoffTab";
import { RankingsTab } from "@/components/RankingsTab";
import { RegionsTab } from "@/components/RegionsTab";
import { SchedulesTab } from "@/components/SchedulesTab";
import { simulateSeason } from "@/lib/simulate";
import { REGIONS, TEAMS, clampTier, getTeam } from "@/lib/teams";
import { useModel } from "@/lib/storage";
import type { RegionId, TierId } from "@/lib/types";

const TABS = [
  { id: "regions", label: "Regions" },
  { id: "rankings", label: "Rankings" },
  { id: "schedules", label: "Schedules" },
  { id: "calendar", label: "Calendar" },
  { id: "builder", label: "Builder" },
  { id: "movement", label: "Movement" },
  { id: "playoff", label: "Playoff" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ScheduleModelApp() {
  const [tab, setTab] = useState<TabId>("regions");
  const { assignment, rivals, setAssignment, setRivals, reset } = useModel();
  const season = useMemo(() => simulateSeason(assignment, rivals), [assignment, rivals]);

  const onMove = (teamId: string, region: RegionId, tier: TierId) => {
    const team = getTeam(teamId);
    setAssignment((current) => ({
      ...current,
      [teamId]: { region, tier: clampTier(team, tier) },
    }));
  };

  const counts = useMemo(
    () =>
      REGIONS.map((region) => ({
        ...region,
        n: TEAMS.filter((team) => assignment[team.id]?.region === region.id).length,
      })),
    [assignment],
  );

  return (
    <div className={`app-shell${tab === "playoff" || tab === "schedules" ? " is-wide" : ""}${tab === "schedules" ? " is-compact" : ""}`}>
      <header className="topbar">
        <div className="brand-block">
          <p className="kicker">CFB26 · realignment lab</p>
          <h1 className="brand">Four Regions. Eight-Team Tiers.</h1>
          <p className="subhead">
            224 clubs, full round-robins, named-rivalry protected games, a 13-week
            calendar with a league-wide bye, promotion and relegation, and a 24-team
            all-autobid playoff for Tiers I–III. 2026 is played out on this slate:
            Ole Miss wins every game and the playoff, LSU loses every game, and
            every other result follows 2025 SP+.
          </p>
        </div>
        <div className="top-actions">
          <ul className="region-pills">
            {counts.map((region) => (
              <li key={region.id} style={{ ["--accent" as string]: region.accent }}>
                <b>{region.n}</b>
                {region.short}
              </li>
            ))}
          </ul>
          <button type="button" className="ghost" onClick={reset}>
            Reset auto-fill
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Model sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "is-active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "regions" ? <RegionsTab assignment={assignment} onMove={onMove} /> : null}
      {tab === "rankings" ? <RankingsTab assignment={assignment} season={season} /> : null}
      {tab === "schedules" ? (
        <SchedulesTab assignment={assignment} rivals={rivals} season={season} />
      ) : null}
      {tab === "calendar" ? (
        <CalendarTab assignment={assignment} rivals={rivals} season={season} />
      ) : null}
      {tab === "builder" ? (
        <BuilderTab assignment={assignment} rivals={rivals} season={season} onChangeRivals={setRivals} />
      ) : null}
      {tab === "movement" ? (
        <MovementTab assignment={assignment} season={season} onApply={setAssignment} />
      ) : null}
      {tab === "playoff" ? <PlayoffTab assignment={assignment} season={season} /> : null}
    </div>
  );
}
