"use client";

import type { SeasonPayload } from "@/lib/types";
import { SchoolMark } from "./SchoolMark";

export function HistoryTab({ seasons }: { seasons: SeasonPayload[] }) {
  const rows = [...seasons]
    .sort((a, b) => b.year - a.year)
    .map((season) => {
      const schoolById = new Map(season.schools.map((s) => [s.id, s]));
      const top = season.autoRankIds.slice(0, 10).map((id, index) => ({
        rank: index + 1,
        school: schoolById.get(id),
      }));
      return { season, top };
    });

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-[var(--muted)]">
        Formula rankings at the end of each academic year. Opinion edits stay in this
        browser and do not rewrite history.
      </p>
      {rows.map(({ season, top }) => (
        <section key={season.year} className="rounded-2xl border border-[var(--line)] p-5">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display), serif" }}>
            {season.label}
          </h2>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {top.map((row) =>
              row.school ? (
                <li key={row.school.id} className="flex items-center gap-3">
                  <span className="w-6 font-mono text-[var(--muted)]">{row.rank}</span>
                  <SchoolMark school={row.school} />
                </li>
              ) : null,
            )}
          </ol>
        </section>
      ))}
    </div>
  );
}
