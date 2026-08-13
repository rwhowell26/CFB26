"use client";

import { useEffect, useMemo, useState } from "react";
import { BuilderTab } from "@/components/BuilderTab";
import { PlayoffTab } from "@/components/PlayoffTab";
import { RankingsTab } from "@/components/RankingsTab";
import { RegionsTab } from "@/components/RegionsTab";
import { SchedulesTab } from "@/components/SchedulesTab";
import { defaultAssignment, REGIONS, TEAMS } from "@/lib/teams";
import { loadAssignment, saveAssignment } from "@/lib/storage";
import type { Assignment, RegionId, TierId } from "@/lib/types";

const TABS = [
  { id: "regions", label: "Regions" },
  { id: "rankings", label: "Rankings" },
  { id: "schedules", label: "Schedules" },
  { id: "builder", label: "Builder" },
  { id: "playoff", label: "Playoff" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ScheduleModelApp() {
  const [tab, setTab] = useState<TabId>("regions");
  const [assignment, setAssignment] = useState<Assignment>(defaultAssignment);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAssignment(loadAssignment());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveAssignment(assignment);
  }, [assignment, hydrated]);

  const onMove = (teamId: string, region: RegionId, tier: TierId) => {
    setAssignment((current) => ({
      ...current,
      [teamId]: { region, tier },
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
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="kicker">CFB26 · realignment lab</p>
          <h1 className="brand">Four Regions. Three Tiers.</h1>
          <p className="subhead">
            A 12-game national model with protected rivals, standing-based crossover games,
            and a 24-team playoff that still leaves a door open in every tier.
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
          <button
            type="button"
            className="ghost"
            onClick={() => setAssignment(defaultAssignment())}
          >
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
      {tab === "rankings" ? <RankingsTab assignment={assignment} /> : null}
      {tab === "schedules" ? <SchedulesTab assignment={assignment} /> : null}
      {tab === "builder" ? <BuilderTab assignment={assignment} /> : null}
      {tab === "playoff" ? <PlayoffTab assignment={assignment} /> : null}
    </div>
  );
}
