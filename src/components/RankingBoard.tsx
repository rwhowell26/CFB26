"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type ReactNode } from "react";
import { shortConferenceName } from "@/lib/conferences";
import { insertIndexByRecord, sortTeamIdsByRecord } from "@/lib/ranking-logic";
import type { Team } from "@/lib/types";

const RANKED_CONTAINER = "ranked-container";
const UNRANKED_CONTAINER = "unranked-container";

type Props = {
  teamsById: Map<string, Team>;
  rankedIds: string[];
  unrankedIds: string[];
  records: Map<string, { wins: number; losses: number }>;
  onChange: (rankedIds: string[]) => void;
  onSelectTeam: (teamId: string) => void;
  selectedTeamId: string | null;
  search: string;
};

function TeamRowContent({
  team,
  rank,
  record,
  active,
}: {
  team: Team;
  rank: number | null;
  record: { wins: number; losses: number };
  active?: boolean;
}) {
  return (
    <div className={`team-row ${active ? "team-row-active" : ""}`}>
      <span className="rank-badge">{rank ?? "—"}</span>
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" className="team-logo" />
      ) : (
        <span className="team-logo team-logo-fallback">{team.abbreviation.slice(0, 2)}</span>
      )}
      <div className="team-meta">
        <div className="team-name">{team.shortName}</div>
        <div className="team-sub">
          {shortConferenceName(team.conference)} · {record.wins}-{record.losses}
        </div>
      </div>
    </div>
  );
}

function SortableRankedItem({
  id,
  team,
  rank,
  record,
  selected,
  onSelect,
}: {
  id: string;
  team: Team;
  rank: number;
  record: { wins: number; losses: number };
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, data: { container: "ranked" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className={`rank-item ${selected ? "selected" : ""}`}>
      <button
        type="button"
        className="drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button type="button" className="team-select" onClick={onSelect}>
        <TeamRowContent team={team} rank={rank} record={record} active={selected} />
      </button>
    </li>
  );
}

function DraggablePoolItem({
  id,
  team,
  record,
  selected,
  onSelect,
}: {
  id: string;
  team: Team;
  record: { wins: number; losses: number };
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { container: "unranked" },
  });

  return (
    <li
      ref={setNodeRef}
      className={`pool-item ${selected ? "selected" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label="Drag into rankings"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button type="button" className="team-select" onClick={onSelect}>
        <TeamRowContent team={team} rank={null} record={record} active={selected} />
      </button>
    </li>
  );
}

function DroppableList({
  id,
  className,
  children,
}: {
  id: string;
  className: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className}${isOver ? " drop-over" : ""}`}>
      {children}
    </div>
  );
}

export function RankingBoard({
  teamsById,
  rankedIds,
  unrankedIds,
  records,
  onChange,
  onSelectTeam,
  selectedTeamId,
  search,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const filteredUnranked = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? unrankedIds
      : unrankedIds.filter((id) => {
          const t = teamsById.get(id);
          if (!t) return false;
          return (
            t.name.toLowerCase().includes(q) ||
            t.shortName.toLowerCase().includes(q) ||
            t.abbreviation.toLowerCase().includes(q) ||
            t.conference.toLowerCase().includes(q)
          );
        });

    return sortTeamIdsByRecord(filtered, records, (id) => teamsById.get(id)?.name ?? id);
  }, [search, teamsById, unrankedIds, records]);

  const containerOf = (id: string): "ranked" | "unranked" | null => {
    if (id === RANKED_CONTAINER) return "ranked";
    if (id === UNRANKED_CONTAINER) return "unranked";
    if (rankedIds.includes(id)) return "ranked";
    if (unrankedIds.includes(id) || filteredUnranked.includes(id)) return "unranked";
    return null;
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTeamId = String(active.id);
    const overId = String(over.id);
    const from = containerOf(activeTeamId);
    const to = containerOf(overId);
    if (!from || !to) return;

    // Reorder within rankings
    if (from === "ranked" && to === "ranked") {
      if (activeTeamId === overId) return;
      if (overId === RANKED_CONTAINER) return;
      const oldIndex = rankedIds.indexOf(activeTeamId);
      const newIndex = rankedIds.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;
      onChange(arrayMove(rankedIds, oldIndex, newIndex));
      return;
    }

    // Drag from pool into rankings
    if (from === "unranked" && to === "ranked") {
      if (rankedIds.includes(activeTeamId)) return;
      const next = [...rankedIds];
      if (overId === RANKED_CONTAINER || next.length === 0) {
        next.splice(insertIndexByRecord(next, activeTeamId, records), 0, activeTeamId);
      } else {
        const overIndex = next.indexOf(overId);
        next.splice(overIndex < 0 ? next.length : overIndex, 0, activeTeamId);
      }
      onChange(next);
      return;
    }

    // Drag from rankings back to pool
    if (from === "ranked" && to === "unranked") {
      onChange(rankedIds.filter((id) => id !== activeTeamId));
    }
  };

  const activeTeam = activeId ? teamsById.get(activeId) : null;
  const activeRank =
    activeId && rankedIds.includes(activeId) ? rankedIds.indexOf(activeId) + 1 : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="rank-layout">
        <section className="panel">
          <header className="panel-header">
            <h2>Your rankings</h2>
            <p>
              {rankedIds.length} / {rankedIds.length + unrankedIds.length} placed · drag to
              reorder · drop pool teams here
            </p>
          </header>
          <DroppableList id={RANKED_CONTAINER} className="rank-drop-zone">
            <SortableContext items={rankedIds} strategy={verticalListSortingStrategy}>
              <ol className="rank-list">
                {rankedIds.map((id, index) => {
                  const team = teamsById.get(id);
                  if (!team) return null;
                  return (
                    <SortableRankedItem
                      key={id}
                      id={id}
                      team={team}
                      rank={index + 1}
                      record={records.get(id) ?? { wins: 0, losses: 0 }}
                      selected={selectedTeamId === id}
                      onSelect={() => onSelectTeam(id)}
                    />
                  );
                })}
              </ol>
            </SortableContext>
            {!rankedIds.length && (
              <div className="empty-state drop-hint">
                Drag teams from the unranked pool into this ballot.
              </div>
            )}
          </DroppableList>
        </section>

        <section className="panel">
          <header className="panel-header">
            <h2>Unranked pool</h2>
            <p>Sorted by record (best first). Drag a team into your rankings.</p>
          </header>
          <DroppableList id={UNRANKED_CONTAINER} className="pool-drop-zone">
            <ul className="pool-list">
              {filteredUnranked.map((id) => {
                const team = teamsById.get(id);
                if (!team) return null;
                const record = records.get(id) ?? { wins: 0, losses: 0 };
                return (
                  <DraggablePoolItem
                    key={id}
                    id={id}
                    team={team}
                    record={record}
                    selected={selectedTeamId === id}
                    onSelect={() => onSelectTeam(id)}
                  />
                );
              })}
            </ul>
            {!filteredUnranked.length && (
              <div className="empty-state">
                {unrankedIds.length ? "No teams match your search." : "All 138 teams are ranked."}
              </div>
            )}
          </DroppableList>
        </section>
      </div>

      <DragOverlay>
        {activeTeam ? (
          <div className="drag-overlay">
            <TeamRowContent
              team={activeTeam}
              rank={activeRank}
              record={records.get(activeTeam.id) ?? { wins: 0, losses: 0 }}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
