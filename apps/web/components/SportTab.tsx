"use client";

import { useMemo, useState } from "react";
import type { SeasonPayload, Sport } from "@/lib/types";
import { formatRecord, pct, sortSportResults } from "@/lib/ranking";
import { SchoolMark } from "./SchoolMark";

const TITLES: Record<Sport, string> = {
  football: "Football (FBS + FCS)",
  basketball: "Men’s basketball",
  baseball: "Baseball",
};

export function SportTab({ season, sport }: { season: SeasonPayload; sport: Sport }) {
  const [query, setQuery] = useState("");
  const schoolById = useMemo(
    () => new Map(season.schools.map((school) => [school.id, school])),
    [season.schools],
  );
  const rows = useMemo(() => sortSportResults(season.results[sport]), [season.results, sport]);
  const visible = rows.filter((row) => {
    const school = schoolById.get(row.schoolId);
    if (!school) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      school.location.toLowerCase().includes(q) ||
      school.name.toLowerCase().includes(q) ||
      (row.conference || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-display), serif" }}>
          {TITLES[sport]}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Postseason round first, then win percentage among teams that did not reach the
          bracket.
        </p>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md rounded-xl border border-[var(--line)] bg-[#0b1220] px-3 py-2"
        placeholder="Filter by school or conference"
      />
      <div className="overflow-auto rounded-2xl border border-[var(--line)]">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-[#10182a] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">School</th>
              <th className="px-3 py-3">Round</th>
              <th className="px-3 py-3">Record</th>
              <th className="px-3 py-3">Win %</th>
              <th className="px-3 py-3">Conference</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const school = schoolById.get(row.schoolId);
              if (!school) return null;
              const rank = rows.findIndex((r) => r.schoolId === row.schoolId) + 1;
              return (
                <tr key={row.schoolId} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 font-mono text-[var(--muted)]">{rank}</td>
                  <td className="px-3 py-2">
                    <SchoolMark school={school} />
                  </td>
                  <td className="px-3 py-2">{row.roundLabel}</td>
                  <td className="px-3 py-2 font-mono">{formatRecord(row)}</td>
                  <td className="px-3 py-2 font-mono">{pct(row)}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {row.conference ?? "—"}
                    {row.subdivision ? ` · ${row.subdivision}` : ""}
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
