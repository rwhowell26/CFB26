"use client";

import { useMemo, useState } from "react";
import { rankMapFromOrder } from "@/lib/ranking-logic";
import { formatWeekLabel } from "@/lib/season";
import type { RankingStore, Team, WeekSnapshot } from "@/lib/types";

type Props = {
  store: RankingStore;
  teams: Team[];
  /** Current week draft order (may be incomplete) */
  currentRankedIds: string[];
  currentWeek: number;
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
};

type Mover = {
  team: Team;
  from: number;
  to: number;
  delta: number; // positive = rose (rank number decreased)
};

function snapshotList(store: RankingStore): WeekSnapshot[] {
  return Object.values(store.snapshots).sort((a, b) => a.week - b.week);
}

function buildMovers(
  teamsById: Map<string, Team>,
  fromRanks: Map<string, number>,
  toRanks: Map<string, number>,
): Mover[] {
  const movers: Mover[] = [];
  for (const [id, to] of toRanks) {
    const from = fromRanks.get(id);
    if (from == null) continue;
    const team = teamsById.get(id);
    if (!team) continue;
    const delta = from - to; // rose if positive
    if (delta === 0) continue;
    movers.push({ team, from, to, delta });
  }
  return movers;
}

function MoverList({
  title,
  subtitle,
  movers,
  empty,
  onSelectTeam,
  selectedTeamId,
}: {
  title: string;
  subtitle: string;
  movers: Mover[];
  empty: string;
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
}) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      {!movers.length ? (
        <div className="empty-state">{empty}</div>
      ) : (
        <ol className="movers-list">
          {movers.map((m, index) => {
            const rose = m.delta > 0;
            return (
              <li key={m.team.id}>
                <button
                  type="button"
                  className={`movers-row ${selectedTeamId === m.team.id ? "selected" : ""}`}
                  onClick={() => onSelectTeam?.(m.team.id)}
                >
                  <span className="rank-badge">{index + 1}</span>
                  {m.team.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.team.logo} alt="" className="team-logo" />
                  ) : null}
                  <span className="movers-team">
                    <strong>{m.team.shortName}</strong>
                    <em>
                      #{m.from} → #{m.to}
                    </em>
                  </span>
                  <span className={`movers-delta ${rose ? "up" : "down"}`}>
                    {rose ? "▲" : "▼"} {Math.abs(m.delta)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function MoversTab({
  store,
  teams,
  currentRankedIds,
  currentWeek,
  onSelectTeam,
  selectedTeamId,
}: Props) {
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const snaps = useMemo(() => snapshotList(store), [store]);

  const weekPairs = useMemo(() => {
    const pairs: Array<{ key: string; label: string; from: WeekSnapshot; to: WeekSnapshot }> = [];
    for (let i = 1; i < snaps.length; i++) {
      const from = snaps[i - 1];
      const to = snaps[i];
      pairs.push({
        key: `${from.week}-${to.week}`,
        label: `${from.label} → ${to.label}`,
        from,
        to,
      });
    }
    return pairs;
  }, [snaps]);

  const [weekPairKey, setWeekPairKey] = useState<string>("");
  const selectedPair =
    weekPairs.find((p) => p.key === weekPairKey) ?? weekPairs[weekPairs.length - 1] ?? null;

  const weekMovers = useMemo(() => {
    if (!selectedPair) return { risers: [] as Mover[], droppers: [] as Mover[] };
    const fromRanks = rankMapFromOrder(selectedPair.from.rankedIds);
    const toRanks = rankMapFromOrder(selectedPair.to.rankedIds);
    const all = buildMovers(teamsById, fromRanks, toRanks);
    const risers = [...all].filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta || a.to - b.to);
    const droppers = [...all]
      .filter((m) => m.delta < 0)
      .sort((a, b) => a.delta - b.delta || a.to - b.to);
    return { risers: risers.slice(0, 25), droppers: droppers.slice(0, 25) };
  }, [selectedPair, teamsById]);

  const seasonMovers = useMemo(() => {
    if (!snaps.length) return { risers: [] as Mover[], droppers: [] as Mover[], fromLabel: "", toLabel: "" };

    const first = snaps[0];
    const fromRanks = rankMapFromOrder(first.rankedIds);

    // Prefer latest snapshot; if current week draft is complete, use that as "now"
    const latestSnap = snaps[snaps.length - 1];
    const useCurrent =
      currentRankedIds.length === teams.length && currentRankedIds.length > 0;
    const toRanks = useCurrent
      ? rankMapFromOrder(currentRankedIds)
      : rankMapFromOrder(latestSnap.rankedIds);
    const toLabel = useCurrent
      ? `${formatWeekLabel(currentWeek)} (current ballot)`
      : latestSnap.label;

    // If only one snapshot and no complete current ballot, season movers need two points
    if (!useCurrent && snaps.length < 2) {
      return { risers: [], droppers: [], fromLabel: first.label, toLabel };
    }
    if (useCurrent && latestSnap.week === currentWeek && snaps.length < 2) {
      // current is same week as only snapshot — still compare first to current if ranks differ
    }

    const all = buildMovers(teamsById, fromRanks, toRanks);
    // Skip if from and to are the same snapshot with identical ranks
    if (!all.length && first.week === latestSnap.week && !useCurrent) {
      return { risers: [], droppers: [], fromLabel: first.label, toLabel };
    }

    const risers = [...all].filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta || a.to - b.to);
    const droppers = [...all]
      .filter((m) => m.delta < 0)
      .sort((a, b) => a.delta - b.delta || a.to - b.to);

    return {
      risers: risers.slice(0, 25),
      droppers: droppers.slice(0, 25),
      fromLabel: first.label,
      toLabel,
    };
  }, [snaps, teamsById, currentRankedIds, currentWeek, teams.length]);

  // Draft-vs-last-saved for in-progress weeks
  const draftMovers = useMemo(() => {
    if (!currentRankedIds.length || !snaps.length) {
      return null;
    }
    const prior = [...snaps].reverse().find((s) => s.week < currentWeek) ?? snaps[snaps.length - 1];
    if (!prior) return null;
    // Only compare teams present on the current ballot
    const fromRanks = rankMapFromOrder(prior.rankedIds);
    const toRanks = rankMapFromOrder(currentRankedIds);
    const all = buildMovers(teamsById, fromRanks, toRanks);
    if (!all.length) return null;
    const risers = [...all].filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 15);
    const droppers = [...all]
      .filter((m) => m.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 15);
    return {
      fromLabel: prior.label,
      toLabel: `${formatWeekLabel(currentWeek)} draft`,
      risers,
      droppers,
    };
  }, [currentRankedIds, snaps, currentWeek, teamsById]);

  if (!snaps.length) {
    return (
      <div className="empty-state panel">
        Save at least one weekly snapshot to track risers and droppers. Save two weeks (or build a
        current ballot against last week) to see movement.
      </div>
    );
  }

  return (
    <div className="movers-wrap">
      <section className="panel">
        <header className="panel-header">
          <h2>Movers</h2>
          <p>Biggest climbs and falls from your saved ballots.</p>
        </header>
        {weekPairs.length ? (
          <label className="block-label">
            Past week comparison
            <select
              value={selectedPair?.key ?? ""}
              onChange={(e) => setWeekPairKey(e.target.value)}
            >
              {weekPairs.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="movers-note">Save a second weekly snapshot to unlock week-to-week movers.</p>
        )}
      </section>

      {weekPairs.length ? (
        <div className="movers-grid">
          <MoverList
            title="Weekly risers"
            subtitle={selectedPair ? selectedPair.label : ""}
            movers={weekMovers.risers}
            empty="No risers between these weeks."
            onSelectTeam={onSelectTeam}
            selectedTeamId={selectedTeamId}
          />
          <MoverList
            title="Weekly droppers"
            subtitle={selectedPair ? selectedPair.label : ""}
            movers={weekMovers.droppers}
            empty="No droppers between these weeks."
            onSelectTeam={onSelectTeam}
            selectedTeamId={selectedTeamId}
          />
        </div>
      ) : null}

      <div className="movers-grid">
        <MoverList
          title="Season risers"
          subtitle={
            seasonMovers.fromLabel
              ? `${seasonMovers.fromLabel} → ${seasonMovers.toLabel}`
              : "Needs an early snapshot and a later ballot"
          }
          movers={seasonMovers.risers}
          empty="Not enough saved ballots yet for season movers."
          onSelectTeam={onSelectTeam}
          selectedTeamId={selectedTeamId}
        />
        <MoverList
          title="Season droppers"
          subtitle={
            seasonMovers.fromLabel
              ? `${seasonMovers.fromLabel} → ${seasonMovers.toLabel}`
              : "Needs an early snapshot and a later ballot"
          }
          movers={seasonMovers.droppers}
          empty="Not enough saved ballots yet for season movers."
          onSelectTeam={onSelectTeam}
          selectedTeamId={selectedTeamId}
        />
      </div>

      {draftMovers && (draftMovers.risers.length || draftMovers.droppers.length) ? (
        <>
          <p className="movers-note">
            In-progress {formatWeekLabel(currentWeek)} draft vs {draftMovers.fromLabel} (teams already
            placed this week).
          </p>
          <div className="movers-grid">
            <MoverList
              title="Draft risers"
              subtitle={`${draftMovers.fromLabel} → ${draftMovers.toLabel}`}
              movers={draftMovers.risers}
              empty="No draft risers yet."
              onSelectTeam={onSelectTeam}
              selectedTeamId={selectedTeamId}
            />
            <MoverList
              title="Draft droppers"
              subtitle={`${draftMovers.fromLabel} → ${draftMovers.toLabel}`}
              movers={draftMovers.droppers}
              empty="No draft droppers yet."
              onSelectTeam={onSelectTeam}
              selectedTeamId={selectedTeamId}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
