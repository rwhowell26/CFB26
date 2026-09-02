"use client";

import { useMemo } from "react";
import type { SeasonPayload } from "@/lib/types";
import { allTimeScores } from "@/lib/ranking";
import { SchoolMark } from "./SchoolMark";

export function AllTimeTab({ seasons }: { seasons: SeasonPayload[] }) {
  const schoolById = useMemo(() => {
    const map = new Map<string, SeasonPayload["schools"][number]>();
    for (const season of seasons) {
      for (const school of season.schools) map.set(school.id, school);
    }
    return map;
  }, [seasons]);
  const scores = useMemo(() => allTimeScores(seasons), [seasons]);
  const rows = [...scores.entries()]
    .map(([id, row]) => ({ id, ...row, school: schoolById.get(id) }))
    .filter((row) => row.school)
    .sort((a, b) => b.points - a.points || a.avgRank - b.avgRank);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)]">
        Combined formula points across loaded seasons ({seasons.map((s) => s.label).join(", ")}
        ). Average rank is the mean department finish.
      </p>
      <div className="overflow-auto rounded-2xl border border-[var(--line)]">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-[#10182a] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">School</th>
              <th className="px-3 py-3">Years</th>
              <th className="px-3 py-3">Avg rank</th>
              <th className="px-3 py-3">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-t border-[var(--line)]">
                <td className="px-3 py-2 font-mono text-[var(--muted)]">{index + 1}</td>
                <td className="px-3 py-2">
                  <SchoolMark school={row.school!} />
                </td>
                <td className="px-3 py-2">{row.years}</td>
                <td className="px-3 py-2 font-mono">{row.avgRank.toFixed(1)}</td>
                <td className="px-3 py-2 font-mono">{Math.round(row.points).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
