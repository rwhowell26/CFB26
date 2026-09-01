"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CompareTool } from "@/components/CompareTool";
import { ConferenceTab } from "@/components/ConferenceTab";
import { ConflictQueue } from "@/components/ConflictQueue";
import { FullBoardTab } from "@/components/FullBoardTab";
import { HistoryTab } from "@/components/HistoryTab";
import { MoversTab } from "@/components/MoversTab";
import { RankingBoard } from "@/components/RankingBoard";
import { SlateTab } from "@/components/SlateTab";
import { SosTab } from "@/components/SosTab";
import { TeamResume } from "@/components/TeamResume";
import {
  applyWinnerAboveLoser,
  philosophyWarnings,
  rankMapFromOrder,
  recordFromGames,
  resultMoveSuggestions,
} from "@/lib/ranking-logic";
import {
  buildDirectWinGraph,
  buildResultsBallot,
  buildTransitiveWins,
  findCyclePairs,
} from "@/lib/results-rank";
import { FBS_TEAM_COUNT, PRESEASON_WEEK, SEASON_YEAR, formatWeekLabel } from "@/lib/season";
import {
  clearDraft,
  exportStoreJson,
  getDraftOrder,
  hydrateStoreFromLocalStorage,
  importStoreJson,
  mostRecentPriorRanks,
  previousWeekBallot,
  resumeRankMap,
  saveSnapshot,
  setDraftOrder,
  useRankingStore,
} from "@/lib/storage";
import type { Game, SeasonWeek, Team } from "@/lib/types";
import { ensureSeasonWeeks } from "@/lib/weeks";

type Tab = "rank" | "board" | "slate" | "conferences" | "sos" | "compare" | "history" | "movers";

type GamesPayload = {
  season: number;
  currentWeek: number;
  teams: Team[];
  weeks: SeasonWeek[];
  games: Game[];
};

export function RankingApp() {
  const [data, setData] = useState<GamesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useRankingStore();
  const [week, setWeek] = useState(() =>
    typeof store.activeWeek === "number" ? store.activeWeek : PRESEASON_WEEK,
  );
  const [tab, setTab] = useState<Tab>("rank");
  const [selectedRankedId, setSelectedRankedId] = useState<string | null>(null);
  const [selectedUnrankedId, setSelectedUnrankedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Re-read localStorage after mount so current ballot → Preseason migration applies
    const hydrated = hydrateStoreFromLocalStorage();
    queueMicrotask(() => {
      setWeek(
        typeof hydrated.activeWeek === "number" ? hydrated.activeWeek : PRESEASON_WEEK,
      );
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);

    (async () => {
      try {
        const res = await fetch("/api/games", { signal: controller.signal });
        const json = (await res.json()) as GamesPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load season data");
        if (cancelled) return;
        setData(json);

        // Prefer Preseason / the week that actually has ballot data
        setWeek((prev) => {
          const preDraft = store.drafts[String(PRESEASON_WEEK)];
          if (preDraft?.length || store.snapshots[String(PRESEASON_WEEK)]) {
            return PRESEASON_WEEK;
          }
          if (store.drafts[String(prev)]?.length || store.snapshots[String(prev)]) {
            return prev;
          }
          if (typeof store.activeWeek === "number") return store.activeWeek;
          return typeof json.currentWeek === "number" ? json.currentWeek : prev;
        });
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error && err.name === "AbortError"
              ? "Timed out loading schedules. Refresh to try again."
              : err instanceof Error
                ? err.message
                : "Failed to load data";
          setError(message);
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
    // Mount-only season fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teams = useMemo(() => data?.teams ?? [], [data]);
  const games = useMemo(() => data?.games ?? [], [data]);
  const weeks = useMemo(
    () => ensureSeasonWeeks(data?.weeks ?? []),
    [data?.weeks],
  );
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const rankedIds = useMemo(() => getDraftOrder(store, week), [store, week]);
  const rankedSet = useMemo(() => new Set(rankedIds), [rankedIds]);
  const unrankedIds = useMemo(
    () => teams.map((t) => t.id).filter((id) => !rankedSet.has(id)),
    [teams, rankedSet],
  );
  const lastWeekBallot = useMemo(() => previousWeekBallot(store, week), [store, week]);

  useEffect(() => {
    if (selectedRankedId && !rankedSet.has(selectedRankedId)) {
      setSelectedUnrankedId((prev) => prev ?? selectedRankedId);
      setSelectedRankedId(null);
    }
  }, [rankedSet, selectedRankedId]);

  useEffect(() => {
    if (selectedUnrankedId && rankedSet.has(selectedUnrankedId)) {
      setSelectedRankedId((prev) => prev ?? selectedUnrankedId);
      setSelectedUnrankedId(null);
    }
  }, [rankedSet, selectedUnrankedId]);

  const ranks = useMemo(() => rankMapFromOrder(rankedIds), [rankedIds]);
  const priorRanks = useMemo(() => mostRecentPriorRanks(store), [store]);
  const resumeRanks = useMemo(
    () => resumeRankMap(ranks, priorRanks, teams.map((t) => t.id)),
    [ranks, priorRanks, teams],
  );
  const records = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number }>();
    for (const team of teams) {
      map.set(team.id, recordFromGames(team.id, games));
    }
    return map;
  }, [teams, games]);

  const warnings = useMemo(
    () => philosophyWarnings(rankedIds, teamsById, games),
    [rankedIds, teamsById, games],
  );
  const suggestions = useMemo(
    () => resultMoveSuggestions(rankedIds, teamsById, games),
    [rankedIds, teamsById, games],
  );
  const cycleNotes = useMemo(() => {
    if (!rankedIds.length) return [];
    const direct = buildDirectWinGraph(rankedIds, games);
    const transitive = buildTransitiveWins(rankedIds, direct);
    return findCyclePairs(rankedIds, transitive)
      .slice(0, 20)
      .map((pair) => ({
        a: pair.a,
        b: pair.b,
        aName: teamsById.get(pair.a)?.shortName ?? pair.a,
        bName: teamsById.get(pair.b)?.shortName ?? pair.b,
      }));
  }, [rankedIds, games, teamsById]);
  const seasonWeek = data?.currentWeek ?? PRESEASON_WEEK;

  const rankedCompare = selectedRankedId ? teamsById.get(selectedRankedId) : null;
  const unrankedCompare = selectedUnrankedId ? teamsById.get(selectedUnrankedId) : null;
  const selectedTeamId = selectedRankedId ?? selectedUnrankedId;
  const weekMeta = weeks.find((w) => w.number === week);
  const snapshotExists = Boolean(store.snapshots[String(week)]);

  const handleSelectTeam = (teamId: string) => {
    if (rankedSet.has(teamId)) setSelectedRankedId(teamId);
    else setSelectedUnrankedId(teamId);
  };

  const updateRanked = (nextRanked: string[]) => {
    startTransition(() => {
      setStore(setDraftOrder(store, week, nextRanked));
    });
  };

  const applySuggestion = (suggestion: {
    winnerId: string;
    loserId: string;
    actionLabel: string;
  }) => {
    const next = applyWinnerAboveLoser(rankedIds, suggestion.winnerId, suggestion.loserId);
    if (next === rankedIds || next.every((id, i) => id === rankedIds[i])) {
      setMessage("Ballot already has the winner above the loser.");
      return;
    }
    updateRanked(next);
    setMessage(`Applied: ${suggestion.actionLabel}`);
  };

  const handleFixRemaining = (remaining: {
    winnerId: string;
    loserId: string;
  }[]) => {
    let next = rankedIds;
    let repairs = 0;
    for (const pair of remaining) {
      const applied = applyWinnerAboveLoser(next, pair.winnerId, pair.loserId);
      if (applied !== next) {
        repairs += 1;
        next = applied;
      }
    }
    if (!repairs) {
      setMessage("No remaining head-to-head fixes.");
      return;
    }
    updateRanked(next);
    setMessage(`Fixed ${repairs} head-to-head conflict${repairs === 1 ? "" : "s"}.`);
  };

  const handleCopyLastWeek = () => {
    if (!lastWeekBallot) {
      setMessage("No previous week rankings to copy.");
      return;
    }
    const label = formatWeekLabel(week, weekMeta?.label);
    if (
      rankedIds.length > 0 &&
      !confirm(
        `Replace ${label} with ${lastWeekBallot.label} rankings (${lastWeekBallot.rankedIds.length} teams)?`,
      )
    ) {
      return;
    }
    const valid = new Set(teams.map((t) => t.id));
    const copied = lastWeekBallot.rankedIds.filter((id) => valid.has(id));
    updateRanked(copied);
    setMessage(`Copied ${lastWeekBallot.label} into ${label}.`);
  };

  const handleAutoRank = () => {
    if (
      rankedIds.length > 0 &&
      !confirm(
        "Replace the current ballot with a results-based order?\n\nUses record, head-to-head, transitive wins, and SOS. You can still drag afterward for early-season opinion.",
      )
    ) {
      return;
    }

    const prior = Object.values(store.snapshots).sort((a, b) => b.week - a.week)[0];
    const preserveOrder =
      rankedIds.length > 0 ? rankedIds : prior?.rankedIds ?? teams.map((t) => t.id);

    const result = buildResultsBallot(
      teams.map((t) => t.id),
      games,
      { preserveOrder, teamsById },
    );

    updateRanked(result.rankedIds);

    const gapCount = result.cyclePairs.length;
    setMessage(
      `Auto-ranked by results · ${result.h2hRepairs} H2H repair${result.h2hRepairs === 1 ? "" : "s"} · ${result.remainingH2hConflicts} conflict${result.remainingH2hConflicts === 1 ? "" : "s"} left · ${gapCount} opinion gap${gapCount === 1 ? "" : "s"}`,
    );
  };

  const changeWeek = (nextWeek: number) => {
    setWeek(nextWeek);
    const next = { ...store, activeWeek: nextWeek };
    if (!next.drafts[String(nextWeek)] && !next.snapshots[String(nextWeek)]) {
      next.drafts = { ...next.drafts, [String(nextWeek)]: [] };
    } else if (next.snapshots[String(nextWeek)] && !next.drafts[String(nextWeek)]) {
      next.drafts = {
        ...next.drafts,
        [String(nextWeek)]: [...next.snapshots[String(nextWeek)].rankedIds],
      };
    }
    setStore(next);
    setMessage(null);
  };

  const handleSaveSnapshot = () => {
    try {
      const label = formatWeekLabel(week, weekMeta?.label);
      setStore(saveSnapshot(store, week, label, rankedIds));
      setMessage(`Saved ${label} snapshot (${FBS_TEAM_COUNT} teams).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save snapshot");
    }
  };

  const handleFreshWeek = () => {
    const label = formatWeekLabel(week, weekMeta?.label);
    if (!confirm(`Clear ${label} draft and start fresh?`)) return;
    const next = clearDraft(store, week);
    next.drafts[String(week)] = [];
    setStore(next);
    setMessage(`${label} draft cleared.`);
  };

  const handleExport = () => {
    const blob = new Blob([exportStoreJson(store)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cfb${SEASON_YEAR}-rankings.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importStoreJson(text);
      setStore(imported);
      setWeek(typeof imported.activeWeek === "number" ? imported.activeWeek : week);
      setMessage("Imported rankings backup.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
    }
  };

  if (loading) {
    return <div className="boot">Loading {SEASON_YEAR} FBS schedules…</div>;
  }

  if (error || !data) {
    return (
      <div className="boot error">
        <p>Could not load season data.</p>
        <p>{error}</p>
        <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">CFB{String(SEASON_YEAR).slice(2)}</p>
          <h1>Personal FBS Rankings</h1>
          <p className="tagline">
            Drag-and-drop ballot · games played drive the resume · wins over everything
          </p>
        </div>
        <div className="top-actions">
          <label className="week-select">
            Ranking week
            <select
              value={String(week)}
              onChange={(e) => changeWeek(Number(e.target.value))}
            >
              {weeks.map((w) => (
                <option key={w.number} value={String(w.number)}>
                  {w.label}
                  {store.snapshots[String(w.number)] ? " · saved" : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary-btn" onClick={handleAutoRank}>
            Auto-rank
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleCopyLastWeek}
            disabled={!lastWeekBallot}
            title={
              lastWeekBallot
                ? `Copy ${lastWeekBallot.label} into this week`
                : "No previous week rankings"
            }
          >
            Use last week
          </button>
          <button type="button" className="primary-btn" onClick={handleSaveSnapshot}>
            Save week
          </button>
          <button type="button" className="ghost-btn" onClick={handleFreshWeek}>
            Start fresh
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Main">
        {(
          [
            ["rank", "Rank"],
            ["board", "Board"],
            ["slate", "Slate"],
            ["conferences", "Conferences"],
            ["sos", "SOS"],
            ["compare", "Compare"],
            ["history", "History"],
            ["movers", "Movers"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search teams or conferences"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="toolbar-meta">
          <span>
            {rankedIds.length}/{FBS_TEAM_COUNT} ranked
            {snapshotExists ? " · snapshot saved" : ""}
            {isPending ? " · updating…" : ""}
          </span>
          <button type="button" className="ghost-btn" onClick={handleExport}>
            Export
          </button>
          <label className="ghost-btn file-btn">
            Import
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      {message ? <div className="toast">{message}</div> : null}

      {tab === "rank" ? (
        <div className="rank-page">
          <RankingBoard
            teamsById={teamsById}
            rankedIds={rankedIds}
            unrankedIds={unrankedIds}
            records={records}
            onChange={updateRanked}
            onSelectTeam={handleSelectTeam}
            selectedTeamIds={[selectedRankedId, selectedUnrankedId].filter(
              (id): id is string => Boolean(id),
            )}
            search={search}
          />

          <section className="resume-compare-wrap">
            <header className="panel-header">
              <h2>Resume compare</h2>
              <p>
                Left is a team already on this week&apos;s ballot. Right is a team still in the
                unranked pool. Click one from each list to compare.
              </p>
            </header>
            <div className="resume-compare">
              {rankedCompare ? (
                <TeamResume
                  team={rankedCompare}
                  games={games}
                  currentRanks={ranks}
                  priorRanks={priorRanks}
                  resumeRanks={resumeRanks}
                  roleLabel="On this week's ballot"
                  onClose={() => setSelectedRankedId(null)}
                />
              ) : (
                <section className="panel">
                  <header className="panel-header">
                    <p className="eyebrow">On this week&apos;s ballot</p>
                    <h2>Select a ranked team</h2>
                    <p>Click a team in Your rankings to park it here.</p>
                  </header>
                </section>
              )}
              {unrankedCompare ? (
                <TeamResume
                  team={unrankedCompare}
                  games={games}
                  currentRanks={ranks}
                  priorRanks={priorRanks}
                  resumeRanks={resumeRanks}
                  roleLabel="Not yet ranked"
                  onClose={() => setSelectedUnrankedId(null)}
                />
              ) : (
                <section className="panel">
                  <header className="panel-header">
                    <p className="eyebrow">Not yet ranked</p>
                    <h2>Select an unranked team</h2>
                    <p>Click a team in the unranked pool to park it here.</p>
                  </header>
                </section>
              )}
            </div>
            {selectedRankedId ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={() =>
                  updateRanked(rankedIds.filter((id) => id !== selectedRankedId))
                }
              >
                Remove left team from ballot
              </button>
            ) : null}
          </section>

          <ConflictQueue
            key={week}
            suggestions={suggestions}
            warnings={warnings}
            cycleNotes={cycleNotes}
            teamsById={teamsById}
            games={games}
            currentRanks={ranks}
            priorRanks={priorRanks}
            resumeRanks={resumeRanks}
            onApply={applySuggestion}
            onApplyAll={handleFixRemaining}
            onSelectTeam={handleSelectTeam}
          />
        </div>
      ) : null}

      {tab === "board" ? (
        <FullBoardTab
          teamsById={teamsById}
          rankedIds={rankedIds}
          onSelectTeam={handleSelectTeam}
          selectedTeamId={selectedTeamId}
        />
      ) : null}

      {tab === "slate" ? (
        <SlateTab
          games={games}
          weeks={weeks}
          seasonWeek={seasonWeek}
          ranks={resumeRanks}
          onSelectTeam={handleSelectTeam}
          selectedTeamId={selectedTeamId}
        />
      ) : null}

      {tab === "conferences" ? (
        <ConferenceTab
          teams={teams}
          ranks={ranks}
          records={records}
          onSelectTeam={handleSelectTeam}
          selectedTeamId={selectedTeamId}
        />
      ) : null}

      {tab === "sos" ? (
        <SosTab
          teams={teams}
          games={games}
          ranks={resumeRanks}
          records={records}
          search={search}
        />
      ) : null}

      {tab === "movers" ? (
        <MoversTab
          store={store}
          teams={teams}
          currentRankedIds={rankedIds}
          currentWeek={week}
          onSelectTeam={handleSelectTeam}
          selectedTeamId={selectedTeamId}
        />
      ) : null}

      {tab === "compare" ? (
        <CompareTool teams={teams} games={games} ranks={ranks} />
      ) : null}

      {tab === "history" ? (
        <HistoryTab
          store={store}
          teams={teams}
          onLoadWeek={(w) => {
            changeWeek(w);
            setTab("rank");
          }}
        />
      ) : null}
    </div>
  );
}
