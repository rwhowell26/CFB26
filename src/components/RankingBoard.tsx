"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
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
import { useMemo, useState } from "react";
import { insertIndexByRecord, sortTeamIdsByRecord } from "@/lib/ranking-logic";
import type { Team } from "@/lib/types";

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
          {team.conference.replace(" Conference", "")} · {record.wins}-{record.losses}
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
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className={`rank-item ${selected ? "selected" : ""}`}>
      <button type="button" className="drag-handle" aria-label="Drag to reorder" {...attributes} {...listeners}>
        ⋮⋮
      </button>
      <button type="button" className="team-select" onClick={onSelect}>
        <TeamRowContent team={team} rank={rank} record={record} active={selected} />
      </button>
    </li>
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

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rankedIds.indexOf(String(active.id));
    const newIndex = rankedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(rankedIds, oldIndex, newIndex));
  };

  const addTeam = (teamId: string, mode: "by-record" | "top" | "bottom" = "by-record") => {
    if (rankedIds.includes(teamId)) return;
    const next = [...rankedIds];
    if (mode === "top") next.unshift(teamId);
    else if (mode === "bottom") next.push(teamId);
    else next.splice(insertIndexByRecord(next, teamId, records), 0, teamId);
    onChange(next);
  };

  const activeTeam = activeId ? teamsById.get(activeId) : null;

  return (
    <div className="rank-layout">
      <section className="panel">
        <header className="panel-header">
          <h2>Your rankings</h2>
          <p>
            {rankedIds.length} / {rankedIds.length + unrankedIds.length} placed · drag to reorder ·
            start fresh each week
          </p>
        </header>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
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
          <DragOverlay>
            {activeTeam ? (
              <div className="drag-overlay">
                <TeamRowContent
                  team={activeTeam}
                  rank={(rankedIds.indexOf(activeTeam.id) + 1) || null}
                  record={records.get(activeTeam.id) ?? { wins: 0, losses: 0 }}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        {!rankedIds.length && (
          <div className="empty-state">Add teams from the pool to begin this week&apos;s ballot.</div>
        )}
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Unranked pool</h2>
          <p>
            Sorted by record (best first). + inserts by record into your ballot; +1 forces #1.
          </p>
        </header>
        <ul className="pool-list">
          {filteredUnranked.map((id) => {
            const team = teamsById.get(id);
            if (!team) return null;
            const record = records.get(id) ?? { wins: 0, losses: 0 };
            return (
              <li key={id} className={`pool-item ${selectedTeamId === id ? "selected" : ""}`}>
                <button type="button" className="team-select" onClick={() => onSelectTeam(id)}>
                  <TeamRowContent team={team} rank={null} record={record} active={selectedTeamId === id} />
                </button>
                <div className="pool-actions">
                  <button type="button" onClick={() => addTeam(id, "top")} title="Insert at #1">
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => addTeam(id, "by-record")}
                    title="Insert by record"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {!filteredUnranked.length && (
          <div className="empty-state">
            {unrankedIds.length ? "No teams match your search." : "All 138 teams are ranked."}
          </div>
        )}
      </section>

      </div>
  );
}
