import { CBB_SEASON_YEAR } from "./cbb-season";
import { emptyMetrics } from "./cbb-metrics";
import { buildTeamNameIndex, lookupTeamByName } from "./cbb-names";
import type { CbbTeam, CbbTeamMetrics } from "./cbb-types";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchText(url: string, extra: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "*/*", "User-Agent": BROWSER_UA, ...extra },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Feed failed (${res.status}) for ${url}`);
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Feed failed (${res.status}) for ${url}`);
  return res.json() as Promise<T>;
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").replace(/^\+/, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "N/A") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function setMetric(
  metrics: Record<string, CbbTeamMetrics>,
  teamId: string,
  key: keyof Pick<CbbTeamMetrics, "sor" | "kpi" | "wab" | "kenpom" | "bpi" | "torvik">,
  value: number | null,
) {
  if (value == null || !Number.isFinite(value) || value <= 0) return;
  const row = metrics[teamId] ?? emptyMetrics(teamId);
  metrics[teamId] = { ...row, [key]: value };
}

function fillMissing(
  metrics: Record<string, CbbTeamMetrics>,
  key: keyof Pick<CbbTeamMetrics, "sor" | "kpi" | "wab" | "kenpom" | "bpi" | "torvik">,
  ranks: Map<string, number>,
) {
  for (const [id, rank] of ranks) {
    if (metrics[id]?.[key] == null) setMetric(metrics, id, key, rank);
  }
}

/** Rank 1 = best when higher scores are better. */
export function ranksFromHigherBetter(scores: Map<string, number>): Map<string, number> {
  const sorted = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  return new Map(sorted.map(([id], index) => [id, index + 1]));
}

export function barttorvikRankColumns(header: string[]): { rank: number; wabRk: number } {
  const lower = header.map((col) => col.trim().toLowerCase());
  return {
    rank: lower.indexOf("rank"),
    wabRk: lower.indexOf("wab rk"),
  };
}

export function parseKenPomRanks(
  text: string,
  index: ReturnType<typeof buildTeamNameIndex<CbbTeam>>,
): Map<string, number> {
  const map = new Map<string, number>();
  const linked =
    /\|\s*(\d+)\s*\|\s*\[([^\]]+)\]\([^)]+\)\s*\|\s*\[[^\]]+\]\([^)]+\)\s*\|\s*\d+-\d+\s*\|\s*([+-]?\d+\.\d+)/g;
  const plain = /\|\s*(\d+)\s*\|\s*([^|[\]\n]+)\s*\|\s*[A-Z0-9]+\s*\|\s*\d+-\d+\s*\|\s*([+-]?\d+\.\d+)/g;
  for (const pattern of [linked, plain]) {
    for (const match of text.matchAll(pattern)) {
      const team = lookupTeamByName(match[2]!.trim(), index);
      const rank = parseNumber(match[1]);
      if (team && rank != null) map.set(team.id, rank);
    }
  }
  const tsv = /^(\d+)\t([^\t]+)\t[A-Z0-9]+\t\d+-\d+\t([+-]?\d+\.\d+)/gm;
  for (const match of text.matchAll(tsv)) {
    const team = lookupTeamByName(match[2]!.trim(), index);
    const rank = parseNumber(match[1]);
    if (team && rank != null) map.set(team.id, rank);
  }
  return map;
}

export function parseTorvikRanks(
  csv: string,
  index: ReturnType<typeof buildTeamNameIndex<CbbTeam>>,
): { torvik: Map<string, number>; wab: Map<string, number> } {
  const torvik = new Map<string, number>();
  const wab = new Map<string, number>();
  const adjEm = new Map<string, number>();
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = lines.shift()?.split(",") ?? [];
  const cols = barttorvikRankColumns(header);
  const teamIdx = header.findIndex((col) => col.toLowerCase() === "team");
  const adjoeIdx = header.findIndex((col) => col.toLowerCase() === "adjoe");
  const adjdeIdx = header.findIndex((col) => col.toLowerCase() === "adjde");
  for (const line of lines) {
    const cells = line.split(",");
    const team = lookupTeamByName(cells[teamIdx] ?? "", index);
    if (!team) continue;
    const rank = parseNumber(cells[cols.rank]);
    if (rank != null) torvik.set(team.id, rank);
    const wabRank = parseNumber(cells[cols.wabRk]);
    if (wabRank != null) wab.set(team.id, wabRank);
    const adjoe = parseNumber(cells[adjoeIdx]);
    const adjde = parseNumber(cells[adjdeIdx]);
    if (adjoe != null && adjde != null) adjEm.set(team.id, adjoe - adjde);
  }
  if (!torvik.size && adjEm.size) {
    for (const [id, rank] of ranksFromHigherBetter(adjEm)) torvik.set(id, rank);
  }
  return { torvik, wab };
}

async function fetchKenPomRanks(index: ReturnType<typeof buildTeamNameIndex<CbbTeam>>): Promise<Map<string, number>> {
  const urls = [
    `https://r.jina.ai/https://kenpom.com/index.php?y=${CBB_SEASON_YEAR}`,
    "https://r.jina.ai/https://kenpom.com/index.php",
  ];
  let text = "";
  for (const url of urls) {
    try {
      text = await fetchText(url, { Accept: "text/plain" });
      if (text.includes("Duke") && (text.includes("NetRtg") || text.includes("+") || text.includes("\t"))) {
        break;
      }
    } catch {
      /* try the next mirror */
    }
  }
  if (!text) return new Map();
  return parseKenPomRanks(text, index);
}

async function fetchEspnBpiAndSor(
  index: ReturnType<typeof buildTeamNameIndex<CbbTeam>>,
): Promise<{ bpi: Map<string, number>; sorRank: Map<string, number> }> {
  const bpi = new Map<string, number>();
  const bpiValues = new Map<string, number>();
  const sorRank = new Map<string, number>();
  const data = await fetchJson<{
    categories?: Array<{ name?: string; names?: string[] }>;
    teams?: Array<{
      team?: { id?: string; displayName?: string };
      categories?: Array<{ name?: string; values?: Array<number | null> }>;
    }>;
    pagination?: { pages?: number };
  }>(
    "https://site.web.api.espn.com/apis/fitt/v3/sports/basketball/mens-college-basketball/powerindex?limit=400",
  );

  const parent = data.categories ?? [];
  const bpiNames = parent.find((item) => item.name === "bpi")?.names ?? [];
  const resumeNames = parent.find((item) => item.name === "resume")?.names ?? [];
  const bpiRankIndex = bpiNames.indexOf("bpirank");
  const bpiValueIndex = bpiNames.indexOf("bpi");
  const sorIndex = resumeNames.indexOf("sorrank");

  for (const row of data.teams ?? []) {
    const id = row.team?.id ? String(row.team.id) : lookupTeamByName(row.team?.displayName ?? "", index)?.id;
    if (!id) continue;
    const bpiCat = row.categories?.find((item) => item.name === "bpi");
    const resumeCat = row.categories?.find((item) => item.name === "resume");
    const bpiRank = bpiRankIndex >= 0 ? bpiCat?.values?.[bpiRankIndex] : null;
    const bpiValue = bpiValueIndex >= 0 ? bpiCat?.values?.[bpiValueIndex] : bpiCat?.values?.[0];
    const sorValue = sorIndex >= 0 ? resumeCat?.values?.[sorIndex] : resumeCat?.values?.[0];
    if (typeof bpiRank === "number") bpi.set(id, bpiRank);
    else if (typeof bpiValue === "number") bpiValues.set(id, bpiValue);
    if (typeof sorValue === "number") sorRank.set(id, sorValue);
  }
  if (!bpi.size && bpiValues.size) {
    for (const [id, rank] of ranksFromHigherBetter(bpiValues)) bpi.set(id, rank);
  }
  return { bpi, sorRank };
}

async function fetchTorvikAndWab(
  index: ReturnType<typeof buildTeamNameIndex<CbbTeam>>,
): Promise<{ torvik: Map<string, number>; wab: Map<string, number> }> {
  const csv = await fetchText(`https://barttorvik.com/${CBB_SEASON_YEAR}_team_results.csv`);
  return parseTorvikRanks(csv, index);
}

async function fetchWarrenNolanRanks(index: ReturnType<typeof buildTeamNameIndex<CbbTeam>>): Promise<{
  kpi: Map<string, number>;
  sor: Map<string, number>;
  wab: Map<string, number>;
  pom: Map<string, number>;
  trank: Map<string, number>;
}> {
  const kpi = new Map<string, number>();
  const sor = new Map<string, number>();
  const wab = new Map<string, number>();
  const pom = new Map<string, number>();
  const trank = new Map<string, number>();
  const html = await fetchText(
    `https://www.warrennolan.com/basketball/${CBB_SEASON_YEAR}/net-teamsheets-plus`,
  );
  const resume =
    /id="([^"]+)-full"[\s\S]*?KPI:<br>\s*SOR:<br>\s*WAB:[\s\S]*?ts-data-left">\s*([\dN/A]+)<br>\s*([\dN/A]+)<br>\s*([\dN/A]+)/gi;
  for (const match of html.matchAll(resume)) {
    const team = lookupTeamByName(match[1]!.replace(/-/g, " "), index);
    const kpiRank = parseNumber(match[2]);
    const sorRank = parseNumber(match[3]);
    const wabRank = parseNumber(match[4]);
    if (team && kpiRank != null) kpi.set(team.id, kpiRank);
    if (team && sorRank != null) sor.set(team.id, sorRank);
    if (team && wabRank != null) wab.set(team.id, wabRank);
  }
  const predictive =
    /id="([^"]+)-full"[\s\S]*?BPI:<br>\s*POM:<br>\s*T-Rank:[\s\S]*?ts-data-left">\s*([\dN/A]+)<br>\s*([\dN/A]+)<br>\s*([\dN/A]+)/gi;
  for (const match of html.matchAll(predictive)) {
    const team = lookupTeamByName(match[1]!.replace(/-/g, " "), index);
    const pomRank = parseNumber(match[3]);
    const trankRank = parseNumber(match[4]);
    if (team && pomRank != null) pom.set(team.id, pomRank);
    if (team && trankRank != null) trank.set(team.id, trankRank);
  }
  return { kpi, sor, wab, pom, trank };
}

export async function fetchCbbMetrics(teams: CbbTeam[]): Promise<Record<string, CbbTeamMetrics>> {
  const metrics: Record<string, CbbTeamMetrics> = {};
  for (const team of teams) metrics[team.id] = emptyMetrics(team.id);
  const index = buildTeamNameIndex(teams);

  const settled = await Promise.allSettled([
    fetchKenPomRanks(index),
    fetchEspnBpiAndSor(index),
    fetchTorvikAndWab(index),
    fetchWarrenNolanRanks(index),
  ]);

  const kenpom = settled[0].status === "fulfilled" ? settled[0].value : new Map<string, number>();
  const espn = settled[1].status === "fulfilled" ? settled[1].value : { bpi: new Map(), sorRank: new Map() };
  const torvik = settled[2].status === "fulfilled" ? settled[2].value : { torvik: new Map(), wab: new Map() };
  const nolan =
    settled[3].status === "fulfilled"
      ? settled[3].value
      : { kpi: new Map(), sor: new Map(), wab: new Map(), pom: new Map(), trank: new Map() };

  for (const [id, value] of kenpom) setMetric(metrics, id, "kenpom", value);
  fillMissing(metrics, "kenpom", nolan.pom);

  for (const [id, value] of espn.bpi) setMetric(metrics, id, "bpi", value);

  for (const [id, value] of torvik.torvik) setMetric(metrics, id, "torvik", value);
  fillMissing(metrics, "torvik", nolan.trank);

  for (const [id, value] of torvik.wab) setMetric(metrics, id, "wab", value);
  fillMissing(metrics, "wab", nolan.wab);

  for (const [id, rank] of nolan.kpi) setMetric(metrics, id, "kpi", rank);

  for (const [id, rank] of espn.sorRank) setMetric(metrics, id, "sor", rank);
  fillMissing(metrics, "sor", nolan.sor);

  return metrics;
}
