"use client";

import { useMemo, useState } from "react";
import type { SeasonPayload } from "@/lib/types";
import { conferenceGroups } from "@/lib/ranking";
import { SchoolMark } from "./SchoolMark";

export function ConferenceTab({ season, order }: { season: SeasonPayload; order: string[] }) {
  const groups = useMemo(() => conferenceGroups(season, order), [season, order]);
  const schoolById = useMemo(
    () => new Map(season.schools.map((school) => [school.id, school])),
    [season.schools],
  );
  const [open, setOpen] = useState(groups[0]?.conference ?? "");
  const selected = groups.find((g) => g.conference === open);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)]">
        Conferences are grouped from men’s basketball membership when available, otherwise
        football. Average rank uses the current board (formula or your opinion). Click a
        conference to see its schools.
      </p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="overflow-auto rounded-2xl border border-[var(--line)]">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-[#10182a] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Conference</th>
              <th className="px-3 py-3">Teams</th>
              <th className="px-3 py-3">Avg rank</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <tr
                key={group.conference}
                className={`cursor-pointer border-t border-[var(--line)] hover:bg-white/5 ${open === group.conference ? "bg-white/10" : ""}`}
                onClick={() => setOpen(group.conference)}
              >
                <td className="px-3 py-2 font-mono text-[var(--muted)]">{index + 1}</td>
                <td className="px-3 py-2">{group.conference}</td>
                <td className="px-3 py-2">{group.schoolIds.length}</td>
                <td className="px-3 py-2 font-mono">{group.averageRank.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <section className="rounded-2xl border border-[var(--line)] p-5">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display), serif" }}>
            {selected.conference}
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {selected.schoolIds.map((id) => {
              const school = schoolById.get(id);
              const rank = order.indexOf(id) + 1;
              return school ? (
                <li key={id} className="flex items-center gap-3">
                  <span className="w-8 font-mono text-[var(--muted)]">{rank || "—"}</span>
                  <SchoolMark school={school} />
                </li>
              ) : null;
            })}
          </ul>
        </section>
      ) : null}
      </div>
    </div>
  );
}
