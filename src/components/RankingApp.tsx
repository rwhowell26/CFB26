"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { BuildTab } from "@/components/BuildTab";
import { CompareTool } from "@/components/CompareTool";
import { ConferenceTab } from "@/components/ConferenceTab";
import { ConflictQueue } from "@/components/ConflictQueue";
import { FullBoardTab } from "@/components/FullBoardTab";
import { HistoryTab } from "@/components/HistoryTab";
import { MoversTab } from "@/components/MoversTab";
import { RankingBoard } from "@/components/RankingBoard";
import { RecommendPanel } from "@/components/RecommendPanel";
import { PlayoffRaceTab } from "@/components/PlayoffRaceTab";
import { SlateTab } from "@/components/SlateTab";
import { SosTab } from "@/components/SosTab";
import { emptyPlayoffRace } from "@/lib/playoff-race";
import {
  applyWinnerAboveLoser,
  buildRecordSowBallot,
  philosophyWarnings,
  rankMapFromOrder,
  recordFromGames,
  resultMoveSuggestions,
} from "@/lib/ranking-logic";
import {
  buildDirectWinGraph,
  buildTransitiveWins,
  findCyclePairs,
} from "@/lib/results-rank";
import { emptyPairwiseSession } from "@/lib/pairwise-build";
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
  setPairwiseProgress,
  useRankingStore,
} from "@/lib/storage";
import type { CfpPoll, Game, PairwiseSession, RankingStore, SeasonWeek, Team } from "@/lib/types";
import { ensureSeasonWeeks } from "@/lib/weeks";

type Tab =
  | "build"
  | "rank"
  | "board"
  | "slate"
  | "conferences"
  | "playoff"
  | "sos"
  | "compare"
  | "history"
  | "movers";

type GamesPayload = {
  season: number;
  currentWeek: number;
  teams: Team[];
  weeks: SeasonWeek[];
  games: Game[];
  cfp?: CfpPoll;
};

function applyFormulaSeed(
  currentStore: RankingStore,
  targetWeek: number,
  seedTeams: Team[],
  seedGames: Game[],
): RankingStore {
  if (!seedTeams.length) return currentStore;
  const lastWeek = previousWeekBallot(currentStore, targetWeek);
  const lastWeekRanks = new Map<string, number>();
  lastWeek?.rankedIds.forEach((id, index) => lastWeekRanks.set(id, index + 1));
  const hasFinals = seedGames.some((game) => game.status === "final");
  if (!hasFinals && lastWeekRanks.size === 0) return currentStore;

  const teamsById = new Map(seedTeams.map((team) => [team.id, team]));
  return setPairwiseProgress(
    currentStore,
    targetWeek,
    buildRecordSowBallot(
      seedTeams.map((team) => team.id),
      seedGames,
      lastWeekRanks,
      { teamsById },
    ),
    emptyPairwiseSession(targetWeek),
  );
}

function formulaSeedMessage(
  week: number,
  weekLabel: string | undefined,
  lastWeekLabel: string | undefined,
) {
  const label = formatWeekLabel(week, weekLabel);
  return lastWeekLabel
    ? `Seeded ${label} by losses, then SOW/SOL from ${lastWeekLabel}. Scrub same-loss groups on Build, then blend seams.`
    : `Seeded ${label} by losses. Scrub same-loss groups on Build, then blend seams.`;
}

export function RankingApp() {
  const [data, setData] = useState<GamesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useRankingStore();
  const [week, setWeek] = useState(() =>
    typeof store.activeWeek === "number" ? store.activeWeek : PRESEASON_WEEK,
  );
  const [tab, setTab] = useState<Tab>(() => {
    const startWeek = typeof store.activeWeek === "number" ? store.activeWeek : PRESEASON_WEEK;
    return getDraftOrder(store, startWeek).length >= FBS_TEAM_COUNT ? "rank" : "build";
  });
  const [selectedRankedId, setSelectedRankedId] = useState<string | null>(null);
  const [selectedUnrankedId, setSelectedUnrankedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Re-read localStorage after mount so ballot migrations apply before first paint of the board
    hydrateStoreFromLocalStorage();
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

        // Open the season's current week, unless Week 6 is empty because the
        // latest build was moved back onto Week 5.
        const seasonWeek =
          typeof json.currentWeek === "number" ? json.currentWeek : PRESEASON_WEEK;
        const latest = hydrateStoreFromLocalStorage();
        const currentCount = getDraftOrder(latest, seasonWeek).length;
        const week5Count = getDraftOrder(latest, 5).length;
        const openWeek =
          seasonWeek === 6 && currentCount === 0 && week5Count >= FBS_TEAM_COUNT
            ? 5
            : seasonWeek;
        let nextStore = latest.activeWeek === openWeek ? latest : { ...latest, activeWeek: openWeek };
        if (getDraftOrder(nextStore, openWeek).length === 0) {
          nextStore = applyFormulaSeed(nextStore, openWeek, json.teams, json.games);
          if (getDraftOrder(nextStore, openWeek).length > 0) {
            setTab("build");
            setMessage(
              formulaSeedMessage(
                openWeek,
                json.weeks.find((item) => item.number === openWeek)?.label,
                previousWeekBallot(nextStore, openWeek)?.label,
              ),
            );
          }
        }
        setWeek(openWeek);
        if (openWeek === 5 && week5Count >= FBS_TEAM_COUNT) setTab("rank");
        if (nextStore !== latest) setStore(nextStore);
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
  const cfp = useMemo(
    () => data?.cfp ?? { published: false, week: null, weekLabel: null, ranks: [] },
    [data],
  );
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
  const lastWeekRanks = useMemo(() => {
    const map = new Map<string, number>();
    lastWeekBallot?.rankedIds.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [lastWeekBallot]);

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
    setStore(
      setPairwiseProgress(store, week, copied, emptyPairwiseSession(week)),
    );
    setTab("build");
    setMessage(`Copied ${lastWeekBallot.label} into ${label}. Scrub same-loss groups on Build.`);
  };

  const insertUnrankedAt = (teamId: string, index: number) => {
    if (rankedIds.includes(teamId)) return;
    const next = [...rankedIds];
    const clamped = Math.max(0, Math.min(index, next.length));
    next.splice(clamped, 0, teamId);
    updateRanked(next);
    setSelectedUnrankedId(null);
    const teamName = teamsById.get(teamId)?.shortName ?? "Team";
    setMessage(`Placed ${teamName} at #${clamped + 1}.`);
  };

  const handleAutoRank = () => {
    if (
      rankedIds.length > 0 &&
      !confirm(
        lastWeekBallot
          ? `Replace the current ballot with loss groups, then SOW/SOL from ${lastWeekBallot.label}?\n\nScrub same-loss pairs on Build, then blend seams.`
          : "Replace the current ballot by losses, then wins / SOW / SOL?\n\nScrub same-loss pairs on Build, then blend seams.",
      )
    ) {
      return;
    }

    setStore(applyFormulaSeed(store, week, teams, games));
    setTab("build");
    setMessage(
      lastWeekBallot
        ? `Auto-ranked by losses, then SOW/SOL from ${lastWeekBallot.label}.`
        : "Auto-ranked by losses.",
    );
  };

  const changeWeek = (nextWeek: number) => {
    setWeek(nextWeek);
    let next = { ...store, activeWeek: nextWeek };
    if (next.snapshots[String(nextWeek)] && !next.drafts[String(nextWeek)]) {
      next = {
        ...next,
        drafts: {
          ...next.drafts,
          [String(nextWeek)]: [...next.snapshots[String(nextWeek)].rankedIds],
        },
      };
    } else if (!next.drafts[String(nextWeek)]?.length) {
      const seeded = applyFormulaSeed(next, nextWeek, teams, games);
      if (getDraftOrder(seeded, nextWeek).length > 0) {
        setStore(seeded);
        setTab("build");
        setMessage(
          formulaSeedMessage(
            nextWeek,
            weeks.find((item) => item.number === nextWeek)?.label,
            previousWeekBallot(seeded, nextWeek)?.label,
          ),
        );
        return;
      }
      next = {
        ...next,
        drafts: { ...next.drafts, [String(nextWeek)]: [] },
      };
    }
    setStore(next);
    setMessage(null);
  };

  const handlePairwiseCommit = useCallback(
    (nextRanked: string[], pairwise: PairwiseSession) => {
      setStore(setPairwiseProgress(store, week, nextRanked, pairwise));
    },
    [setStore, store, week],
  );

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
    if (!confirm(`Clear ${label} and re-seed from losses + last week's SOW/SOL?`)) return;
    const cleared = clearDraft(store, week);
    cleared.drafts[String(week)] = [];
    cleared.pairwise = undefined;
    const seeded = applyFormulaSeed(cleared, week, teams, games);
    if (getDraftOrder(seeded, week).length === 0) {
      setStore(cleared);
      setTab("build");
      setMessage(`${label} draft cleared.`);
      return;
    }
    setStore(seeded);
    setTab("build");
    setMessage(`${label} re-seeded by losses, then last week's SOW/SOL.`);
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
            Seeded by losses and last week&apos;s SOW/SOL · scrub and blend on Build
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
            ["build", "Build"],
            ["rank", "Rank"],
            ["board", "Board"],
            ["slate", "Slate"],
            ["conferences", "Conferences"],
            ["playoff", "Playoff"],
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
          placeholder="Search remaining teams or conferences"
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

      {tab === "build" ? (
        <BuildTab
          week={week}
          weekLabel={weekMeta?.label}
          teams={teams}
          teamsById={teamsById}
          rankedIds={rankedIds}
          session={store.pairwise}
          games={games}
          records={records}
          lastWeekRanks={lastWeekRanks}
          currentRanks={ranks}
          priorRanks={priorRanks}
          resumeRanks={ranks}
          lastWeekLabel={lastWeekBallot?.label}
          onCommit={handlePairwiseCommit}
          onOpenRank={() => {
            setTab("rank");
            setMessage("Preference pass complete — edit on Rank.");
          }}
        />
      ) : null}

      {tab === "rank" ? (
        <div className="rank-page">
          <div className="rank-workspace">
            <RankingBoard
              teamsById={teamsById}
              rankedIds={rankedIds}
              totalTeams={teams.length || FBS_TEAM_COUNT}
              records={records}
              onChange={updateRanked}
              onSelectTeam={handleSelectTeam}
              selectedTeamIds={[selectedRankedId, selectedUnrankedId].filter(
                (id): id is string => Boolean(id),
              )}
            />
            <RecommendPanel
              teamsById={teamsById}
              unrankedIds={unrankedIds}
              rankedIds={rankedIds}
              records={records}
              lastWeekBallot={lastWeekBallot}
              lastWeekRanks={lastWeekRanks}
              search={search}
              selectedRankedId={selectedRankedId}
              games={games}
              currentRanks={ranks}
              priorRanks={priorRanks}
              resumeRanks={resumeRanks}
              onClearRanked={() => setSelectedRankedId(null)}
              onInsert={insertUnrankedAt}
            />
          </div>
          {selectedRankedId ? (
            <button
              type="button"
              className="ghost-btn"
              onClick={() =>
                updateRanked(rankedIds.filter((id) => id !== selectedRankedId))
              }
            >
              Remove selected team from ballot
            </button>
          ) : null}

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

      {tab === "playoff" ? (
        <PlayoffRaceTab
          teams={teams}
          games={games}
          cfp={cfp}
          state={store.playoffRace ?? emptyPlayoffRace()}
          onChange={(playoffRace) => setStore({ ...store, playoffRace })}
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
