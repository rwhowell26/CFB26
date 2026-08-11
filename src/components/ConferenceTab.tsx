"use client";

import { useMemo, useState } from "react";
import type { Team } from "@/lib/types";

type Props = {
  teams: Team[];
  ranks: Map<string, number>;
  records: Map<string, { wins: number; losses: number }>;
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
};

function displayConference(name: string): string {
  if (name.startsWith("Sun Belt")) return "Sun Belt Conference";
  return name;
}

function shortConference(name: string): string {
  return displayConference(name)
    .replace(" Conference", "")
    .replace("FBS Independents", "Independents");
}

export function ConferenceTab({
  teams,
  ranks,
  records,
  onSelectTeam,
  selectedTeamId,
}: Props) {
  const conferences = useMemo(() => {
    const groups = new Map<string, Team[]>();
    for (const team of teams) {
      const key = displayConference(team.conference);
      const list = groups.get(key) ?? [];
      list.push(team);
      groups.set(key, list);
    }

    return Array.from(groups.entries())
      .map(([name, members]) => {
        const ordered = [...members].sort((a, b) => {
          const ar = ranks.get(a.id);
          const br = ranks.get(b.id);
          if (ar != null && br != null) return ar - br;
          if (ar != null) return -1;
          if (br != null) return 1;
          return a.name.localeCompare(b.name);
        });
        const rankedCount = ordered.filter((t) => ranks.has(t.id)).length;
        const bestOverall = ordered.reduce<number | null>((best, team) => {
          const r = ranks.get(team.id);
          if (r == null) return best;
          if (best == null || r < best) return r;
          return best;
        }, null);
        return { name, ordered, rankedCount, bestOverall };
      })
      .sort((a, b) => {
        if (a.bestOverall != null && b.bestOverall != null) {
          return a.bestOverall - b.bestOverall;
        }
        if (a.bestOverall != null) return -1;
        if (b.bestOverall != null) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [teams, ranks]);

  const [focus, setFocus] = useState<string>("all");

  const visible = focus === "all" ? conferences : conferences.filter((c) => c.name === focus);

  return (
    <div className="conference-wrap">
      <section className="panel conference-controls-panel">
        <header className="panel-header">
          <h2>Conference rankings</h2>
          <p>
            Built from your current ballot. Conferences ordered by their highest-ranked team.
          </p>
        </header>
        <label className="block-label">
          Conference
          <select value={focus} onChange={(e) => setFocus(e.target.value)}>
            <option value="all">All conferences</option>
            {conferences.map((c) => (
              <option key={c.name} value={c.name}>
                {shortConference(c.name)}
                {c.bestOverall != null ? ` · best #${c.bestOverall}` : " · none ranked"}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="conference-grid">
        {visible.map((conf) => (
          <section key={conf.name} className="panel conference-card">
            <header className="panel-header">
              <h2>{shortConference(conf.name)}</h2>
              <p>
                {conf.rankedCount}/{conf.ordered.length} ranked
                {conf.bestOverall != null ? ` · best overall #${conf.bestOverall}` : ""}
              </p>
            </header>
            <ol className="conference-list">
              {conf.ordered.map((team, index) => {
                const overall = ranks.get(team.id);
                const record = records.get(team.id) ?? { wins: 0, losses: 0 };
                const selected = selectedTeamId === team.id;
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      className={`conference-row ${selected ? "selected" : ""}`}
                      onClick={() => onSelectTeam?.(team.id)}
                    >
                      <span className="rank-badge">{index + 1}</span>
                      {team.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo} alt="" className="team-logo" />
                      ) : null}
                      <span className="conference-team">
                        <strong>{team.shortName}</strong>
                        <em>
                          {record.wins}-{record.losses}
                        </em>
                      </span>
                      <span className="conference-overall">
                        {overall != null ? `#${overall}` : "NR"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
