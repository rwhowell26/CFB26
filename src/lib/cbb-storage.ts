"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CBB_SEASON_YEAR, CBB_STORE_SCHEMA_VERSION, CBB_STORAGE_KEY, formatCbbDate } from "./cbb-season";
import type { CbbDraft, CbbSnapshot, CbbStore } from "./cbb-types";

function emptyStore(): CbbStore {
  return {
    season: CBB_SEASON_YEAR,
    schemaVersion: CBB_STORE_SCHEMA_VERSION,
    snapshots: [],
    draft: null,
    viewingId: null,
  };
}

function sanitizeSnapshot(value: unknown): CbbSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CbbSnapshot>;
  if (typeof row.id !== "string" || typeof row.createdAt !== "string") return null;
  if (!Array.isArray(row.sCurve) || !Array.isArray(row.atLargeIds)) return null;
  return {
    id: row.id,
    createdAt: row.createdAt,
    label: formatCbbDate(row.createdAt),
    sCurve: row.sCurve.filter((id): id is string => typeof id === "string"),
    atLargeIds: row.atLargeIds.filter((id): id is string => typeof id === "string"),
    autoBidByConference:
      row.autoBidByConference && typeof row.autoBidByConference === "object"
        ? Object.fromEntries(
            Object.entries(row.autoBidByConference).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : {},
    firstFourOut: Array.isArray(row.firstFourOut)
      ? row.firstFourOut.filter((id): id is string => typeof id === "string")
      : [],
    nextFourOut: Array.isArray(row.nextFourOut)
      ? row.nextFourOut.filter((id): id is string => typeof id === "string")
      : [],
    recommendedIds: Array.isArray(row.recommendedIds)
      ? row.recommendedIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

function sanitizeDraft(value: unknown): CbbDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CbbDraft>;
  if (typeof row.id !== "string" || !Array.isArray(row.rankedIds)) return null;
  return {
    id: row.id,
    startedAt: typeof row.startedAt === "string" ? row.startedAt : new Date().toISOString(),
    basedOnId: typeof row.basedOnId === "string" ? row.basedOnId : null,
    rankedIds: row.rankedIds.filter((id): id is string => typeof id === "string"),
    confirmedPairs: Array.isArray(row.confirmedPairs)
      ? row.confirmedPairs.filter((id): id is string => typeof id === "string")
      : [],
    phase: row.phase === "recommend" ? "recommend" : "lock",
    climbingId: typeof row.climbingId === "string" ? row.climbingId : null,
    recommendQueue: Array.isArray(row.recommendQueue)
      ? row.recommendQueue.filter((id): id is string => typeof id === "string")
      : [],
    history: Array.isArray(row.history)
      ? row.history
          .filter((item) => item && typeof item === "object" && Array.isArray(item.rankedIds))
          .map((item) => ({
            rankedIds: item.rankedIds.filter((id): id is string => typeof id === "string"),
            confirmedPairs: Array.isArray(item.confirmedPairs)
              ? item.confirmedPairs.filter((id): id is string => typeof id === "string")
              : [],
            phase: item.phase === "recommend" ? "recommend" as const : "lock" as const,
            climbingId: typeof item.climbingId === "string" ? item.climbingId : null,
            recommendQueue: Array.isArray(item.recommendQueue)
              ? item.recommendQueue.filter((id): id is string => typeof id === "string")
              : [],
          }))
      : [],
  };
}

function normalizeStore(parsed: Partial<CbbStore> | null): CbbStore {
  const base = emptyStore();
  if (!parsed || parsed.season !== CBB_SEASON_YEAR) return base;
  const snapshots = Array.isArray(parsed.snapshots)
    ? parsed.snapshots.map(sanitizeSnapshot).filter((item): item is CbbSnapshot => Boolean(item))
    : [];
  snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const viewingId =
    typeof parsed.viewingId === "string" && snapshots.some((item) => item.id === parsed.viewingId)
      ? parsed.viewingId
      : snapshots[0]?.id ?? null;
  const keepDraft = parsed.schemaVersion === CBB_STORE_SCHEMA_VERSION;
  return {
    ...base,
    snapshots,
    draft: keepDraft ? sanitizeDraft(parsed.draft) : null,
    viewingId,
  };
}

let memoryStore: CbbStore = emptyStore();
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  memoryStore = loadCbbStore();
}

function emit() {
  for (const listener of listeners) listener();
}

export function loadCbbStore(): CbbStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(CBB_STORAGE_KEY);
    if (!raw) return emptyStore();
    return normalizeStore(JSON.parse(raw) as Partial<CbbStore>);
  } catch {
    return emptyStore();
  }
}

export function saveCbbStore(store: CbbStore) {
  memoryStore = { ...store, schemaVersion: CBB_STORE_SCHEMA_VERSION, season: CBB_SEASON_YEAR };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CBB_STORAGE_KEY, JSON.stringify(memoryStore));
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot = emptyStore();

export function hydrateCbbStoreFromLocalStorage(): CbbStore {
  memoryStore = loadCbbStore();
  emit();
  return memoryStore;
}

export function useCbbStore(): [CbbStore, (next: CbbStore) => void] {
  const store = useSyncExternalStore(subscribe, () => memoryStore, () => serverSnapshot);
  const setStore = useCallback((next: CbbStore) => {
    saveCbbStore(next);
  }, []);
  return [store, setStore];
}

export function latestSnapshot(store: CbbStore): CbbSnapshot | null {
  return store.snapshots[0] ?? null;
}

export function snapshotById(store: CbbStore, id: string | null): CbbSnapshot | null {
  if (!id) return latestSnapshot(store);
  return store.snapshots.find((item) => item.id === id) ?? latestSnapshot(store);
}
