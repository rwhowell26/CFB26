"use client";

import { useCallback, useSyncExternalStore } from "react";
import { FBS_TEAM_COUNT, SEASON_YEAR, STORAGE_KEY } from "./season";
import type { RankingStore, WeekSnapshot } from "./types";

function emptyStore(activeWeek = 1): RankingStore {
  return {
    season: SEASON_YEAR,
    activeWeek,
    drafts: {},
    snapshots: {},
  };
}

let memoryStore: RankingStore = emptyStore();
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  memoryStore = loadStore();
}

function emit() {
  for (const listener of listeners) listener();
}

export function loadStore(): RankingStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as RankingStore;
    if (parsed.season !== SEASON_YEAR) return emptyStore();
    return {
      ...emptyStore(parsed.activeWeek || 1),
      ...parsed,
      drafts: parsed.drafts || {},
      snapshots: parsed.snapshots || {},
    };
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: RankingStore) {
  memoryStore = store;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): RankingStore {
  return memoryStore;
}

const serverSnapshot = emptyStore();

function getServerSnapshot(): RankingStore {
  return serverSnapshot;
}

export function hydrateStoreFromLocalStorage() {
  memoryStore = loadStore();
  emit();
}

export function useRankingStore(): [RankingStore, (next: RankingStore) => void] {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setStore = useCallback((next: RankingStore) => {
    saveStore(next);
  }, []);
  return [store, setStore];
}

export function weekKey(week: number) {
  return String(week);
}

export function getDraftOrder(store: RankingStore, week: number): string[] {
  return store.drafts[weekKey(week)] ?? [];
}

export function setDraftOrder(
  store: RankingStore,
  week: number,
  rankedIds: string[],
): RankingStore {
  return {
    ...store,
    activeWeek: week,
    drafts: {
      ...store.drafts,
      [weekKey(week)]: rankedIds,
    },
  };
}

export function saveSnapshot(
  store: RankingStore,
  week: number,
  label: string,
  rankedIds: string[],
): RankingStore {
  if (rankedIds.length !== FBS_TEAM_COUNT) {
    throw new Error(`Snapshot requires all ${FBS_TEAM_COUNT} teams ranked.`);
  }
  const snapshot: WeekSnapshot = {
    week,
    label,
    rankedIds: [...rankedIds],
    updatedAt: new Date().toISOString(),
    locked: true,
  };
  return {
    ...store,
    activeWeek: week,
    drafts: {
      ...store.drafts,
      [weekKey(week)]: [...rankedIds],
    },
    snapshots: {
      ...store.snapshots,
      [weekKey(week)]: snapshot,
    },
  };
}

export function clearDraft(store: RankingStore, week: number): RankingStore {
  const drafts = { ...store.drafts };
  delete drafts[weekKey(week)];
  return { ...store, drafts };
}

export function exportStoreJson(store: RankingStore): string {
  return JSON.stringify(store, null, 2);
}

export function importStoreJson(raw: string): RankingStore {
  const parsed = JSON.parse(raw) as RankingStore;
  if (parsed.season !== SEASON_YEAR) {
    throw new Error(`Expected season ${SEASON_YEAR}`);
  }
  return parsed;
}

export function teamRankHistory(
  store: RankingStore,
  teamId: string,
): Array<{ week: number; rank: number | null; label: string }> {
  const weeks = Object.values(store.snapshots).sort((a, b) => a.week - b.week);
  return weeks.map((snap) => {
    const idx = snap.rankedIds.indexOf(teamId);
    return {
      week: snap.week,
      label: snap.label,
      rank: idx >= 0 ? idx + 1 : null,
    };
  });
}

export type PriorRank = {
  rank: number;
  week: number;
  label: string;
};

/** Most recent saved ballot rank for each team. */
export function mostRecentPriorRanks(store: RankingStore): Map<string, PriorRank> {
  const map = new Map<string, PriorRank>();
  const snaps = Object.values(store.snapshots).sort((a, b) => a.week - b.week);
  for (const snap of snaps) {
    snap.rankedIds.forEach((id, index) => {
      map.set(id, {
        rank: index + 1,
        week: snap.week,
        label: snap.label,
      });
    });
  }
  return map;
}

export type ResumeRank = {
  rank: number;
  source: "current" | "prior";
  week?: number;
  label?: string;
};

/**
 * Current-week rank when the team is on this week's ballot;
 * otherwise fall back to the most recent saved weekly rank.
 */
export function resolveResumeRank(
  teamId: string,
  currentRanks: Map<string, number>,
  priorRanks: Map<string, PriorRank>,
): ResumeRank | null {
  const current = currentRanks.get(teamId);
  if (current != null) {
    return { rank: current, source: "current" };
  }
  const prior = priorRanks.get(teamId);
  if (prior) {
    return {
      rank: prior.rank,
      source: "prior",
      week: prior.week,
      label: prior.label,
    };
  }
  return null;
}

export function resumeRankMap(
  currentRanks: Map<string, number>,
  priorRanks: Map<string, PriorRank>,
  teamIds: string[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of teamIds) {
    const resolved = resolveResumeRank(id, currentRanks, priorRanks);
    if (resolved) map.set(id, resolved.rank);
  }
  return map;
}

