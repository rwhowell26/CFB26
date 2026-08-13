import { useCallback, useSyncExternalStore } from "react";
import { defaultAssignment } from "./teams";
import type { Assignment } from "./types";

const KEY = "cfb26-schedule-model-v1";
const listeners = new Set<() => void>();
let clientCache: Assignment | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function loadAssignment(): Assignment {
  const fallback = defaultAssignment();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Assignment;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveAssignment(assignment: Assignment) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(assignment));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getClientSnapshot(): Assignment {
  if (!clientCache) clientCache = loadAssignment();
  return clientCache;
}

function getServerSnapshot(): Assignment {
  return defaultAssignment();
}

export function writeAssignment(next: Assignment | ((prev: Assignment) => Assignment)) {
  const prev = getClientSnapshot();
  clientCache = typeof next === "function" ? next(prev) : next;
  saveAssignment(clientCache);
  emit();
}

export function useAssignment() {
  const assignment = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const setAssignment = useCallback((next: Assignment | ((prev: Assignment) => Assignment)) => {
    writeAssignment(next);
  }, []);
  return [assignment, setAssignment] as const;
}
