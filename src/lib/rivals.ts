import { defaultRivals, TEAMS } from "./teams";
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

/** Replace one protected rival. Keeps lists symmetric and repairs leftover teams when possible. */
export function setRival(rivals: RivalMap, teamId: string, slot: number, newRivalId: string): RivalMap {
  if (teamId === newRivalId) return rivals;
  const next = clone({ ...defaultRivals(), ...rivals });
  const current = [...(next[teamId] ?? [])];
  while (current.length < 3) current.push("");
  const old = current[slot];
  if (old === newRivalId) return rivals;

  const already = current.indexOf(newRivalId);
  if (already >= 0) {
    current[already] = old;
    current[slot] = newRivalId;
    next[teamId] = current.filter(Boolean);
    return next;
  }

  if (old) unlink(next, teamId, old);

  let dropped: string | undefined;
  const bList = [...(next[newRivalId] ?? [])];
  if (bList.length >= 3) {
    dropped = bList[bList.length - 1];
    unlink(next, newRivalId, dropped);
  }

  current[slot] = newRivalId;
  next[teamId] = current.filter(Boolean).slice(0, 3);
  link(next, teamId, newRivalId);
  next[newRivalId] = (next[newRivalId] ?? []).slice(0, 3);

  if (old && dropped && old !== dropped) {
    const oldList = next[old] ?? [];
    const dropList = next[dropped] ?? [];
    if (oldList.length < 3 && dropList.length < 3 && !oldList.includes(dropped)) {
      link(next, old, dropped);
    }
  }

  for (const team of TEAMS) {
    next[team.id] = (next[team.id] ?? team.rivals).slice(0, 3);
  }

  return next;
}
