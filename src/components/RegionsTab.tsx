"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { REGIONS, TIER_META, getTeam, recordLabel } from "@/lib/teams";
import { teamsIn } from "@/lib/rankings";
import type { Assignment, RegionId, Team, TierId } from "@/lib/types";

function DropColumn({
  region,
  tier,
  teams,
}: {
  region: RegionId;
  tier: TierId;
  teams: Team[];
}) {
  const id = `${region}:${tier}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={`tier-bucket ${isOver ? "is-over" : ""}`}>
      <header>
        <h3>{TIER_META[tier].name}</h3>
        <span>{teams.length} teams</span>
      </header>
      <div className="tier-list">
        {teams.map((team) => (
          <DragCard key={team.id} team={team} />
        ))}
      </div>
    </section>
  );
}

function TeamCard({ team }: { team: Team }) {
  return (
    <article className="drag-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.logo} alt="" width={26} height={26} />
      <div>
        <strong>{team.shortName}</strong>
        <span>{recordLabel(team)} · {team.state}</span>
      </div>
    </article>
  );
}

function DragCard({ team }: { team: Team }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: team.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TeamCard team={team} />
    </div>
  );
}

export function RegionsTab({
  assignment,
  onMove,
}: {
  assignment: Assignment;
  onMove: (teamId: string, region: RegionId, tier: TierId) => void;
}) {
  const [active, setActive] = useState<Team | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (event: DragStartEvent) => {
    const teamId = String(event.active.id);
    setActive(getTeam(teamId));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const overId = event.over?.id;
    if (!overId) return;
    const [region, tierRaw] = String(overId).split(":");
    const tier = Number(tierRaw) as TierId;
    if (!region || ![1, 2, 3].includes(tier)) return;
    onMove(String(event.active.id), region as RegionId, tier);
  };

  return (
    <div className="stack">
      <p className="lede">
        Conferences are gone. Drag any team into a new region or tier — the rest of the model
        (schedules, rankings, playoff) updates immediately. Starting placement is geographic,
        with tiers split by 2025 record inside each region.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="region-grid">
          {REGIONS.map((region) => (
            <article key={region.id} className="region-column" style={{ ["--accent" as string]: region.accent }}>
              <header className="region-head">
                <h2>{region.name}</h2>
                <p>{region.blurb}</p>
                <strong>{teamsIn(assignment, region.id).length} teams</strong>
              </header>
              {([1, 2, 3] as TierId[]).map((tier) => (
                <DropColumn
                  key={tier}
                  region={region.id}
                  tier={tier}
                  teams={teamsIn(assignment, region.id, tier)}
                />
              ))}
            </article>
          ))}
        </div>
        <DragOverlay>
          {active ? <TeamCard team={active} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
