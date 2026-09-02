"use client";

import { useMemo, useState } from "react";
import type { SeasonPayload } from "@/lib/types";
import { formatRecord, resultMap } from "@/lib/ranking";
import { SchoolMark } from "./SchoolMark";

export function BoardTab({
  season,
  order,
  dirty,
  onMove,
  onReset,
}: {
  season: SeasonPayload;
  order: string[];
  dirty: boolean;
  onMove: (id: string, toIndex: number) => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const [jump, setJump] = useState<Record<string, string>>({});
  const schoolById = useMemo(
    () => new Map(season.schools.map((school) => [school.id, school])),
    [season.schools],
  );
  const football = useMemo(() => resultMap(season.results.football), [season.results.football]);
  const basketball = useMemo(() => resultMap(season.results.basketball), [season.results.basketball]);
  const baseball = useMemo(() => resultMap(season.results.baseball), [season.results.baseball]);

  const filtered = order
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => {
      const school = schoolById.get(id);
      if (!school) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        school.location.toLowerCase().includes(q) ||
        school.name.toLowerCase().includes(q) ||
        school.abbreviation.toLowerCase().includes(q)
      );
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Find a school</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-xl border border-[var(--line)] bg-[#0b1220] px-3 py-2"
            placeholder="Alabama, Gonzaga, NDSU…"
          />
        </label>
        <button
          type="button"
          onClick={onReset}
          disabled={!dirty}
          className="h-10 rounded-full border border-[var(--line)] px-4 text-sm disabled:opacity-40"
        >
          Reset to formula
        </button>
      </div>
      <p className="text-sm text-[var(--muted)]">
        Auto-rank uses furthest postseason round, then win percentage. Move teams to overlay
        your opinion. Formula order is saved separately from your edits.
      </p>
      <div className="overflow-auto rounded-2xl border border-[var(--line)]">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-[#10182a] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">School</th>
              <th className="px-3 py-3">Football</th>
              <th className="px-3 py-3">M Basketball</th>
              <th className="px-3 py-3">Baseball</th>
              <th className="px-3 py-3">Opinion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ id, index }) => {
              const school = schoolById.get(id);
              if (!school) return null;
              const fb = football.get(id);
              const mbb = basketball.get(id);
              const bb = baseball.get(id);
              return (
                <tr key={id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 font-mono text-[var(--muted)]">{index + 1}</td>
                  <td className="px-3 py-2">
                    <SchoolMark school={school} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <SportCell result={fb} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <SportCell result={mbb} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <SportCell result={bb} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button type="button" className="icon-btn" onClick={() => onMove(id, 0)}>
                        Top
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onMove(id, Math.max(0, index - 1))}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onMove(id, Math.min(order.length - 1, index + 1))}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onMove(id, order.length - 1)}
                      >
                        Bottom
                      </button>
                      <form
                        className="flex items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const value = Number(jump[id]);
                          if (Number.isFinite(value) && value >= 1) onMove(id, value - 1);
                        }}
                      >
                        <input
                          aria-label={`Move ${school.location} to rank`}
                          value={jump[id] ?? ""}
                          onChange={(e) => setJump((prev) => ({ ...prev, [id]: e.target.value }))}
                          className="w-14 rounded-lg border border-[var(--line)] bg-[#0b1220] px-2 py-1 font-mono"
                          placeholder="#"
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SportCell({
  result,
}: {
  result: ReturnType<typeof resultMap> extends Map<string, infer R> ? R | undefined : never;
}) {
  if (!result) return <span className="text-[var(--muted)]">—</span>;
  return (
    <span className="flex flex-col">
      <span>{result.roundLabel}</span>
      <span className="text-xs text-[var(--muted)]">
        {formatRecord(result)}
        {result.subdivision ? ` · ${result.subdivision}` : ""}
      </span>
    </span>
  );
}
