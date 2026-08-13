import { isRealRivalry } from "./rivalries";
import { defaultRivals, MAX_RIVALS, TEAMS } from "./teams";
import type { RivalMap } from "./types";

export function rivalsOf(rivals: RivalMap, teamId: string): string[] {
  return rivals[teamId] ?? defaultRivals()[teamId] ?? [];
}

function clone(rivals: RivalMap): RivalMap {
  return Object.fromEntries(Object.entries(rivals).map(([id, list]) => [id, [...list]]));
}

function unlink(map: RivalMap, a: string, b: string) {
  map[a] = (map[a] ?? []).filter((id) => id !== b);
  map[b] = (map[b] ?? []).filter((id) => id !== a);
}

function link(map: RivalMap, a: string, b: string) {
  if (a === b) return;
  if (!(map[a] ?? []).includes(b)) map[a] = [...(map[a] ?? []), b];
  if (!(map[b] ?? []).includes(a)) map[b] = [...(map[b] ?? []), a];
}

function capLists(map: RivalMap) {
  for (const team of TEAMS) {
    map[team.id] = (map[team.id] ?? []).slice(0, MAX_RIVALS);
  }
}

/** Replace or fill one protected-rival slot. Lists stay symmetric; 0–3 rivals is allowed. */
export function setRival(rivals: RivalMap, teamId: string, slot: number, newRivalId: string): RivalMap {
  if (teamId === newRivalId || !isRealRivalry(teamId, newRivalId)) return rivals;
  const next = clone({ ...defaultRivals(), ...rivals });
  const current = [...(next[teamId] ?? [])];
  while (current.length < MAX_RIVALS) current.push("");
  const old = current[slot] ?? "";
  if (old === newRivalId) return rivals;

  const already = current.indexOf(newRivalId);
  if (already >= 0) {
    current[already] = old;
    current[slot] = newRivalId;
    next[teamId] = current.filter(Boolean);
    capLists(next);
    return next;
  }

  if (old) unlink(next, teamId, old);

  const bList = [...(next[newRivalId] ?? [])];
  if (bList.length >= MAX_RIVALS) {
    const dropped = bList.find((id) => id !== teamId) ?? bList[bList.length - 1];
    if (dropped) unlink(next, newRivalId, dropped);
  }

  current[slot] = newRivalId;
  next[teamId] = current.filter(Boolean).slice(0, MAX_RIVALS);
  link(next, teamId, newRivalId);
  capLists(next);
  return next;
}

/** Drop a protected rival without filling the slot. The other club also loses the pairing. */
export function clearRival(rivals: RivalMap, teamId: string, slot: number): RivalMap {
  const next = clone({ ...defaultRivals(), ...rivals });
  const old = (next[teamId] ?? [])[slot];
  if (!old) return rivals;
  unlink(next, teamId, old);
  capLists(next);
  return next;
}
