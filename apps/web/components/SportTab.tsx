"use client";

import { useMemo, useState } from "react";
import type { SeasonPayload, Sport, SportResult } from "@/lib/types";
import { formatRecord, pct, sortSportResults } from "@/lib/ranking";
import { SchoolMark } from "./SchoolMark";

const TITLES: Record<Sport, string> = {
  football: "Football",
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
  const matchesQuery = (row: SportResult) => {
    const school = schoolById.get(row.schoolId);
    if (!school) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      school.location.toLowerCase().includes(q) ||
      school.name.toLowerCase().includes(q) ||
      (row.conference || "").toLowerCase().includes(q)
    );
  };

  if (sport === "football") {
    const fbs = rows.filter((row) => row.subdivision === "FBS");
    const fcs = rows.filter((row) => row.subdivision === "FCS");
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-display), serif" }}>
            {TITLES[sport]}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            FBS and FCS are ranked separately. National champions share the same tier, but a
            team just outside the CFP is not pushed down by FCS playoff teams.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md rounded-xl border border-[var(--line)] bg-[#0b1220] px-3 py-2"
          placeholder="Filter by school or conference"
        />
        <SportTable
          title="FBS"
          rows={fbs.filter(matchesQuery)}
          ranked={fbs}
          schoolById={schoolById}
        />
        <SportTable
          title="FCS"
          rows={fcs.filter(matchesQuery)}
          ranked={fcs}
          schoolById={schoolById}
        />
      </div>
    );
  }

  const visible = rows.filter(matchesQuery);
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
      <SportTable rows={visible} ranked={rows} schoolById={schoolById} />
    </div>
  );
}

function SportTable({
  title,
  rows,
  ranked,
  schoolById,
}: {
  title?: string;
  rows: SportResult[];
  ranked: SportResult[];
  schoolById: Map<string, SeasonPayload["schools"][number]>;
}) {
  const rankOf = useMemo(() => {
    const map = new Map<string, number>();
    ranked.forEach((row, index) => map.set(row.schoolId, index + 1));
    return map;
  }, [ranked]);

  return (
    <div className="flex flex-col gap-3">
      {title ? (
        <h3 className="text-lg" style={{ fontFamily: "var(--font-display), serif" }}>
          {title}
        </h3>
      ) : null}
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
            {rows.map((row) => {
              const school = schoolById.get(row.schoolId);
              if (!school) return null;
              return (
                <tr key={row.schoolId} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 font-mono text-[var(--muted)]">
                    {rankOf.get(row.schoolId)}
                  </td>
                  <td className="px-3 py-2">
                    <SchoolMark school={school} />
                  </td>
                  <td className="px-3 py-2">{row.roundLabel}</td>
                  <td className="px-3 py-2 font-mono">{formatRecord(row)}</td>
                  <td className="px-3 py-2 font-mono">{pct(row)}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.conference ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
