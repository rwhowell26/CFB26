import type { SeasonPayload, SportResult } from "./types";
import { SPORTS } from "./season";

export function resultMap(results: SportResult[]): Map<string, SportResult> {
  return new Map(results.map((row) => [row.schoolId, row]));
}

export function sportScore(row: SportResult): number {
  return row.tier * 10_000 + row.winPct * 1_000 + row.wins;
}

export function sortSportResults(results: SportResult[]): SportResult[] {
  return [...results].sort((a, b) => {
    const diff = sportScore(b) - sportScore(a);
    if (diff) return diff;
    return a.schoolId.localeCompare(b.schoolId);
  });
}

export function compositeScore(payload: SeasonPayload, schoolId: string): number {
  let total = 0;
  for (const sport of SPORTS) {
    const row = payload.results[sport].find((r) => r.schoolId === schoolId);
    if (row) total += sportScore(row);
  }
  return total;
}

export function autoRankSchools(payload: SeasonPayload): string[] {
  return [...payload.schools]
    .map((school) => ({ id: school.id, score: compositeScore(payload, school.id) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((row) => row.id);
}

export function applyOpinionOrder(autoIds: string[], opinion: string[] | undefined): string[] {
  if (!opinion?.length) return autoIds;
  const known = new Set(autoIds);
  const used = new Set<string>();
  const ordered: string[] = [];
  for (const id of opinion) {
    if (known.has(id) && !used.has(id)) {
      ordered.push(id);
      used.add(id);
    }
  }
  for (const id of autoIds) {
    if (!used.has(id)) ordered.push(id);
  }
  return ordered;
}

export function moveTeam(order: string[], id: string, toIndex: number): string[] {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const next = [...order];
  next.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, next.length));
  next.splice(clamped, 0, id);
  return next;
}

export function sportRankMap(results: SportResult[]): Map<string, number> {
  const sorted = sortSportResults(results);
  const map = new Map<string, number>();
  sorted.forEach((row, index) => map.set(row.schoolId, index + 1));
  return map;
}

export function conferenceGroups(
  payload: SeasonPayload,
  order: string[],
): Array<{ conference: string; schoolIds: string[]; averageRank: number }> {
  const rank = new Map(order.map((id, index) => [id, index + 1]));
  const groups = new Map<string, string[]>();
  for (const school of payload.schools) {
    const conference =
      school.conferences.basketball ||
      school.conferences.football ||
      school.conferences.baseball ||
      "Independent";
    const list = groups.get(conference) ?? [];
    list.push(school.id);
    groups.set(conference, list);
  }
  return [...groups.entries()]
    .map(([conference, schoolIds]) => {
      const ranks = schoolIds.map((id) => rank.get(id) ?? order.length).sort((a, b) => a - b);
      const averageRank = ranks.reduce((sum, n) => sum + n, 0) / ranks.length;
      return { conference, schoolIds, averageRank };
    })
    .sort((a, b) => a.averageRank - b.averageRank);
}

export function allTimeScores(seasons: SeasonPayload[]): Map<string, { points: number; years: number; avgRank: number }> {
  const totals = new Map<string, { points: number; rankSum: number; years: number }>();
  for (const season of seasons) {
    season.autoRankIds.forEach((id, index) => {
      const cur = totals.get(id) ?? { points: 0, rankSum: 0, years: 0 };
      cur.points += compositeScore(season, id);
      cur.rankSum += index + 1;
      cur.years += 1;
      totals.set(id, cur);
    });
  }
  const out = new Map<string, { points: number; years: number; avgRank: number }>();
  for (const [id, row] of totals) {
    out.set(id, { points: row.points, years: row.years, avgRank: row.rankSum / row.years });
  }
  return out;
}

export function formatRecord(row: Pick<SportResult, "wins" | "losses" | "ties">): string {
  return row.ties ? `${row.wins}-${row.losses}-${row.ties}` : `${row.wins}-${row.losses}`;
}

export function pct(row: Pick<SportResult, "winPct">): string {
  return row.winPct.toFixed(3).replace(/^0/, "");
}
