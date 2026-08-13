import { useCallback, useSyncExternalStore } from "react";
import { defaultAssignment, defaultRivals, reseedTiers } from "./teams";
import type { Assignment, RivalMap } from "./types";

const KEY = "cfb26-schedule-model-v5";
export const TIER_SEED = "spplus-2025-connelly-table";

export type ModelState = {
  assignment: Assignment;
  rivals: RivalMap;
  tierSeed: string;
};

const listeners = new Set<() => void>();
let clientCache: ModelState | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function fallback(): ModelState {
  return { assignment: defaultAssignment(), rivals: defaultRivals(), tierSeed: TIER_SEED };
}

export function loadState(): ModelState {
  const base = fallback();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<ModelState>;
    const assignment = { ...base.assignment, ...parsed.assignment };
    const rivals = { ...base.rivals, ...parsed.rivals };
    const needsReseed = parsed.tierSeed !== TIER_SEED;
    const state: ModelState = {
      assignment: needsReseed ? reseedTiers(assignment) : assignment,
      rivals,
      tierSeed: TIER_SEED,
    };
    if (needsReseed) saveState(state);
    return state;
  } catch {
    return base;
  }
}

function saveState(state: ModelState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getClientSnapshot(): ModelState {
  if (!clientCache) clientCache = loadState();
  return clientCache;
}

function writeState(next: ModelState | ((prev: ModelState) => ModelState)) {
  const prev = getClientSnapshot();
  clientCache = typeof next === "function" ? next(prev) : next;
  saveState(clientCache);
  emit();
}

export function useModel() {
  const state = useSyncExternalStore(subscribe, getClientSnapshot, fallback);
  const setAssignment = useCallback((next: Assignment | ((prev: Assignment) => Assignment)) => {
    writeState((prev) => ({
      ...prev,
      assignment: typeof next === "function" ? next(prev.assignment) : next,
    }));
  }, []);
  const setRivals = useCallback((next: RivalMap | ((prev: RivalMap) => RivalMap)) => {
    writeState((prev) => ({
      ...prev,
      rivals: typeof next === "function" ? next(prev.rivals) : next,
    }));
  }, []);
  const reset = useCallback(() => writeState(fallback()), []);
  return { ...state, setAssignment, setRivals, reset };
}
