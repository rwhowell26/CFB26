import type { OpinionStore } from "./types";

const KEY = "cfb26-dept-success-v2";

function empty(): OpinionStore {
  return { schemaVersion: 1, seasons: {} };
}

export function loadOpinion(): OpinionStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as OpinionStore;
    if (!parsed?.seasons) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

export function saveOpinion(store: OpinionStore) {
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

export function saveSeasonOrder(year: number, order: string[]): OpinionStore {
  const store = loadOpinion();
  store.seasons[String(year)] = { order, savedAt: new Date().toISOString() };
  saveOpinion(store);
  return store;
}

export function clearSeasonOrder(year: number): OpinionStore {
  const store = loadOpinion();
  delete store.seasons[String(year)];
  saveOpinion(store);
  return store;
}
