import { defaultAssignment } from "./teams";
import type { Assignment } from "./types";

const KEY = "cfb26-schedule-model-v1";

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
