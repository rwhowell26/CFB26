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
import { nextEmptyTier, teamsIn, tiersInRegion } from "@/lib/rankings";
import { REGIONS, TIER_SIZE, getTeam, recordLabel, tierName } from "@/lib/teams";
import type { Assignment, RegionId, Team, TierId } from "@/lib/types";

function DropColumn({
  region,
  tier,
  teams,
  emptyLabel,
}: {
  region: RegionId;
  tier: TierId;
  teams: Team[];
  emptyLabel?: string;
}) {
  const id = `${region}:${tier}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const countOk = teams.length === TIER_SIZE || (teams.length === 0 && emptyLabel);
  return (
    <section ref={setNodeRef} className={`tier-bucket ${isOver ? "is-over" : ""} ${countOk ? "" : "is-warn"}`}>
      <header>
        <h3>{emptyLabel ?? tierName(tier)}</h3>
        <span>{teams.length}/{TIER_SIZE}</span>
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
        <strong>{team.shortName}{team.subdivision === "fcs" ? " · FCS" : ""}</strong>
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
    setActive(getTeam(String(event.active.id)));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const overId = event.over?.id;
    if (!overId) return;
    const [region, tierRaw] = String(overId).split(":");
    const tier = Number(tierRaw);
    if (!region || !Number.isFinite(tier) || tier < 1) return;
    onMove(String(event.active.id), region as RegionId, tier);
  };

  return (
    <div className="stack">
      <p className="lede">
        Drag any team into a new region or tier. Each tier is built for 8 teams so the group
        plays a full round-robin. Regions can have different numbers of tiers — drop a team
        onto “New tier” to add one. Gold warning means that bucket is not at 8 yet.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="region-grid">
          {REGIONS.map((region) => {
            const tiers = tiersInRegion(assignment, region.id);
            const extra = nextEmptyTier(assignment, region.id);
            return (
              <article key={region.id} className="region-column" style={{ ["--accent" as string]: region.accent }}>
                <header className="region-head">
                  <h2>{region.name}</h2>
                  <p>{region.blurb}</p>
                  <strong>{teamsIn(assignment, region.id).length} teams · {tiers.length} tiers</strong>
                </header>
                {tiers.map((tier) => (
                  <DropColumn
                    key={tier}
                    region={region.id}
                    tier={tier}
                    teams={teamsIn(assignment, region.id, tier)}
                  />
                ))}
                <DropColumn
                  region={region.id}
                  tier={extra}
                  teams={[]}
                  emptyLabel={`New ${tierName(extra)}`}
                />
              </article>
            );
          })}
        </div>
        <DragOverlay>
          {active ? <TeamCard team={active} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
