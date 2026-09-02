"use client";

import { useMemo, useState } from "react";
import type { SeasonPayload } from "@/lib/types";
import { SPORTS } from "@/lib/season";
import { formatRecord, resultMap } from "@/lib/ranking";
import { SchoolMark } from "./SchoolMark";

export function TeamTab({
  seasons,
  currentYear,
}: {
  seasons: SeasonPayload[];
  currentYear: number;
}) {
  const current = seasons.find((s) => s.year === currentYear) ?? seasons[0];
  const [selectedId, setSelectedId] = useState(current?.schools[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const school = current?.schools.find((s) => s.id === selectedId);
  const matches = (current?.schools ?? []).filter((s) => {
    const q = query.toLowerCase();
    return (
      s.location.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.abbreviation.toLowerCase().includes(q)
    );
  });

  const history = useMemo(() => {
    if (!selectedId) return [];
    return [...seasons]
      .sort((a, b) => b.year - a.year)
      .map((season) => {
        const rank = season.autoRankIds.indexOf(selectedId);
        return {
          season,
          rank: rank >= 0 ? rank + 1 : null,
          football: resultMap(season.results.football).get(selectedId),
          basketball: resultMap(season.results.basketball).get(selectedId),
          baseball: resultMap(season.results.baseball).get(selectedId),
        };
      });
  }, [seasons, selectedId]);

  if (!current) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="flex flex-col gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-xl border border-[var(--line)] bg-[#0b1220] px-3 py-2"
          placeholder="Search teams"
        />
        <div className="max-h-[32rem] overflow-auto rounded-2xl border border-[var(--line)]">
          {matches.slice(0, 80).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`flex w-full px-3 py-2 text-left hover:bg-white/5 ${item.id === selectedId ? "bg-white/10" : ""}`}
            >
              <SchoolMark school={item} size={22} />
            </button>
          ))}
        </div>
      </aside>
      <section className="flex flex-col gap-4">
        {school ? (
          <>
            <div>
              <SchoolMark school={school} size={40} />
              <p className="mt-2 text-sm text-[var(--muted)]">
                {[school.conferences.basketball, school.conferences.football, school.conferences.baseball]
                  .filter(Boolean)
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .join(" · ") || "Conference TBD"}
              </p>
            </div>
            <div className="overflow-auto rounded-2xl border border-[var(--line)]">
              <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                <thead className="bg-[#10182a] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-3">Season</th>
                    <th className="px-3 py-3">Dept rank</th>
                    {SPORTS.map((sport) => (
                      <th key={sport} className="px-3 py-3 capitalize">
                        {sport === "basketball" ? "M Basketball" : sport}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.season.year} className="border-t border-[var(--line)]">
                      <td className="px-3 py-2">{row.season.label}</td>
                      <td className="px-3 py-2 font-mono">{row.rank ?? "—"}</td>
                      {(["football", "basketball", "baseball"] as const).map((sport) => {
                        const result = row[sport];
                        return (
                          <td key={sport} className="px-3 py-2">
                            {result ? (
                              <span className="flex flex-col">
                                <span>{result.roundLabel}</span>
                                <span className="text-xs text-[var(--muted)]">{formatRecord(result)}</span>
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-[var(--muted)]">Select a school.</p>
        )}
      </section>
    </div>
  );
}
