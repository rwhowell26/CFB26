"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  FBS_TEAM_COUNT,
  LEGACY_STORAGE_KEY,
  PRESEASON_WEEK,
  SEASON_YEAR,
  STORAGE_KEY,
  WEEK_ZERO,
  formatWeekLabel,
} from "./season";
import type { RankingStore, WeekSnapshot } from "./types";

/** Bump when storage shape/migration rules change. */
export const STORE_SCHEMA_VERSION = 4;

function emptyStore(activeWeek = PRESEASON_WEEK): RankingStore {
  return {
    season: SEASON_YEAR,
    schemaVersion: STORE_SCHEMA_VERSION,
    activeWeek,
    drafts: {},
    snapshots: {},
  };
}

/**
 * Move ballot data from old Week-0 slot (key "0") into Preseason (-1),
 * since Week 0 is now reserved for early-season games.
 */
export function migrateWeekZeroSlotToPreseason(store: RankingStore): RankingStore {
  const preKey = String(PRESEASON_WEEK);
  const oldKey = String(WEEK_ZERO);
  const drafts = { ...store.drafts };
  const snapshots = { ...store.snapshots };

  const hasPre = (drafts[preKey]?.length ?? 0) > 0 || Boolean(snapshots[preKey]);
  const hasOld = (drafts[oldKey]?.length ?? 0) > 0 || Boolean(snapshots[oldKey]);

  if (hasOld && !hasPre) {
    if (drafts[oldKey]) {
      drafts[preKey] = [...drafts[oldKey]];
      delete drafts[oldKey];
    }
    if (snapshots[oldKey]) {
      snapshots[preKey] = {
        ...snapshots[oldKey],
        week: PRESEASON_WEEK,
        label: formatWeekLabel(PRESEASON_WEEK),
      };
      delete snapshots[oldKey];
    }
  }

  let activeWeek = store.activeWeek;
  if (activeWeek === WEEK_ZERO && ((drafts[preKey]?.length ?? 0) > 0 || snapshots[preKey])) {
    activeWeek = PRESEASON_WEEK;
  }
  if (typeof activeWeek !== "number") activeWeek = PRESEASON_WEEK;

  return {
    ...store,
    drafts,
    snapshots,
    activeWeek,
    schemaVersion: STORE_SCHEMA_VERSION,
  };
}

/**
 * Move the current ballot into Preseason.
 * Prefers activeWeek data, otherwise the fullest non-empty week.
 */
export function migrateRankingsToPreseason(store: RankingStore): RankingStore {
  const preKey = String(PRESEASON_WEEK);
  const drafts = { ...store.drafts };
  const snapshots = { ...store.snapshots };
  const activeKey = String(
    typeof store.activeWeek === "number" ? store.activeWeek : 1,
  );

  let sourceKey: string | null = null;
  if ((drafts[activeKey]?.length ?? 0) > 0 || snapshots[activeKey]) {
    sourceKey = activeKey;
  } else {
    let bestLen = 0;
    const keys = new Set([...Object.keys(drafts), ...Object.keys(snapshots)]);
    for (const key of keys) {
      const len = Math.max(
        drafts[key]?.length ?? 0,
        snapshots[key]?.rankedIds.length ?? 0,
      );
      if (len > bestLen) {
        bestLen = len;
        sourceKey = key;
      }
    }
  }

  if (!sourceKey) {
    return {
      ...store,
      drafts,
      snapshots,
      activeWeek: PRESEASON_WEEK,
      schemaVersion: STORE_SCHEMA_VERSION,
    };
  }

  if (sourceKey !== preKey) {
    if (drafts[sourceKey]?.length) {
      drafts[preKey] = [...drafts[sourceKey]];
      delete drafts[sourceKey];
    }
    if (snapshots[sourceKey]) {
      const prior = snapshots[sourceKey];
      snapshots[preKey] = {
        ...prior,
        week: PRESEASON_WEEK,
        label: formatWeekLabel(PRESEASON_WEEK),
      };
      delete snapshots[sourceKey];
    }
  }

  return {
    ...store,
    drafts,
    snapshots,
    activeWeek: PRESEASON_WEEK,
    schemaVersion: STORE_SCHEMA_VERSION,
  };
}

function normalizeStore(parsed: RankingStore): RankingStore {
  const activeWeek =
    typeof parsed.activeWeek === "number" ? parsed.activeWeek : PRESEASON_WEEK;
  let store: RankingStore = {
    ...emptyStore(activeWeek),
    ...parsed,
    drafts: parsed.drafts || {},
    snapshots: parsed.snapshots || {},
  };

  const version = store.schemaVersion ?? 1;
  if (version < 3) {
    store = migrateRankingsToPreseason(store);
  }
  if (version < 4) {
    store = migrateWeekZeroSlotToPreseason(store);
  }

  return {
    ...store,
    schemaVersion: STORE_SCHEMA_VERSION,
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

function readRawStore(): RankingStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RankingStore;

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = normalizeStore(JSON.parse(legacy) as RankingStore);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    return null;
  }
  return null;
}

export function loadStore(): RankingStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const parsed = readRawStore();
    if (!parsed) return emptyStore();
    if (parsed.season !== SEASON_YEAR) return emptyStore();
    const normalized = normalizeStore(parsed);
    const priorVersion = parsed.schemaVersion ?? 1;
    if (priorVersion < STORE_SCHEMA_VERSION) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: RankingStore) {
  memoryStore = {
    ...store,
    schemaVersion: STORE_SCHEMA_VERSION,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
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

export function hydrateStoreFromLocalStorage(): RankingStore {
  memoryStore = loadStore();
  emit();
  return memoryStore;
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

export type PriorBallot = {
  week: number;
  label: string;
  rankedIds: string[];
  source: "snapshot" | "draft";
};

/** Nearest earlier week that has a saved snapshot or a non-empty draft. */
export function previousWeekBallot(
  store: RankingStore,
  currentWeek: number,
): PriorBallot | null {
  const weeks = new Set<number>();
  for (const key of Object.keys(store.drafts)) {
    const n = Number(key);
    if (Number.isFinite(n)) weeks.add(n);
  }
  for (const key of Object.keys(store.snapshots)) {
    const n = Number(key);
    if (Number.isFinite(n)) weeks.add(n);
  }

  const prior = [...weeks].filter((w) => w < currentWeek).sort((a, b) => b - a);
  for (const w of prior) {
    const snap = store.snapshots[weekKey(w)];
    if (snap?.rankedIds.length) {
      return {
        week: w,
        label: snap.label || formatWeekLabel(w),
        rankedIds: [...snap.rankedIds],
        source: "snapshot",
      };
    }
    const draft = store.drafts[weekKey(w)];
    if (draft?.length) {
      return {
        week: w,
        label: formatWeekLabel(w),
        rankedIds: [...draft],
        source: "draft",
      };
    }
  }
  return null;
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
  return normalizeStore(parsed);
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
