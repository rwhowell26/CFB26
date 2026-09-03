"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { shortConferenceName } from "@/lib/conferences";
import type { Team } from "@/lib/types";

const RANKED_CONTAINER = "ranked-container";

type Props = {
  teamsById: Map<string, Team>;
  rankedIds: string[];
  totalTeams: number;
  records: Map<string, { wins: number; losses: number }>;
  onChange: (rankedIds: string[]) => void;
  onSelectTeam: (teamId: string) => void;
  selectedTeamIds?: string[];
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
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  id: string;
  team: Team;
  rank: number;
  record: { wins: number; losses: number };
  selected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, data: { container: "ranked" } });
  const rowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (selected && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);

  const setRefs = useCallback(
    (node: HTMLLIElement | null) => {
      setNodeRef(node);
      (rowRef as React.MutableRefObject<HTMLLIElement | null>).current = node;
    },
    [setNodeRef],
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <li ref={setRefs} style={style} className={`rank-item ${selected ? "selected" : ""}`}>
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
      <div className="rank-actions">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          title="Move up one spot"
          aria-label="Move up one spot"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          title="Move down one spot"
          aria-label="Move down one spot"
        >
          ▼
        </button>
      </div>
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
  totalTeams,
  records,
  onChange,
  onSelectTeam,
  selectedTeamIds = [],
}: Props) {
  const selectedSet = useMemo(() => new Set(selectedTeamIds), [selectedTeamIds]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTeamId = String(active.id);
    const overId = String(over.id);
    if (activeTeamId === overId || overId === RANKED_CONTAINER) return;
    const oldIndex = rankedIds.indexOf(activeTeamId);
    const newIndex = rankedIds.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(rankedIds, oldIndex, newIndex));
  };

  const activeTeam = activeId ? teamsById.get(activeId) : null;
  const activeRank =
    activeId && rankedIds.includes(activeId) ? rankedIds.indexOf(activeId) + 1 : null;

  const moveTeam = (teamId: string, direction: "up" | "down") => {
    const index = rankedIds.indexOf(teamId);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rankedIds.length) return;
    onChange(arrayMove(rankedIds, index, target));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <section className="panel rank-ballot-panel">
        <header className="panel-header">
          <h2>Your rankings</h2>
          <p>
            {rankedIds.length} / {totalTeams} placed · odd ranks left, even ranks right · drag to
            reorder
          </p>
        </header>
        <DroppableList id={RANKED_CONTAINER} className="rank-drop-zone">
          <SortableContext items={rankedIds} strategy={rectSortingStrategy}>
            <ol className="rank-list rank-list-2col">
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
                    selected={selectedSet.has(id)}
                    onSelect={() => onSelectTeam(id)}
                    onMoveUp={() => moveTeam(id, "up")}
                    onMoveDown={() => moveTeam(id, "down")}
                    canMoveUp={index > 0}
                    canMoveDown={index < rankedIds.length - 1}
                  />
                );
              })}
            </ol>
          </SortableContext>
          {!rankedIds.length && (
            <div className="empty-state drop-hint">
              Place the recommended team, or copy last week, to start this ballot.
            </div>
          )}
        </DroppableList>
      </section>

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
