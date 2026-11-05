import { normalizeHex } from "./team-colors";
import { CBB_SEASON_YEAR } from "./cbb-season";
import { fetchCbbMetrics } from "./cbb-feeds";
import { emptyMetrics } from "./cbb-metrics";
import type { CbbTeam, CbbTeamMetrics } from "./cbb-types";

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";
const ESPN_V2 = "https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball";

type CacheEntry<T> = { expires: number; value: T };
const memoryCache = new Map<string, CacheEntry<unknown>>();

async function cachedFetch<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = memoryCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await loader();
  memoryCache.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ESPN request failed (${res.status}) for ${url}`);
  }
  return res.json() as Promise<T>;
}

function logoFromTeam(team: {
  logos?: Array<{ href?: string; rel?: string[] }>;
  logo?: string;
}): string | null {
  if (typeof team.logo === "string") return team.logo;
  const logos = team.logos ?? [];
  const preferred =
    logos.find((logo) => logo.rel?.includes("full") && logo.rel?.includes("default")) ?? logos[0];
  return preferred?.href ?? null;
}

type StandingsNode = {
  name?: string;
  standings?: {
    entries?: Array<{
      team: {
        id: string;
        displayName: string;
        shortDisplayName?: string;
        abbreviation?: string;
        logos?: Array<{ href?: string; rel?: string[] }>;
      };
      stats?: Array<{ name?: string; value?: number }>;
    }>;
  };
  children?: StandingsNode[];
};

type ColorRecord = { color: string | null; alternateColor: string | null; logo: string | null };

async function fetchTeamColorMap(): Promise<Map<string, ColorRecord>> {
  return cachedFetch("cbb-team-colors", 60 * 60 * 1000, async () => {
    const data = await getJson<{
      sports?: Array<{
        leagues?: Array<{
          teams?: Array<{
            team?: {
              id?: string;
              color?: string;
              alternateColor?: string;
              logos?: Array<{ href?: string; rel?: string[] }>;
            };
          }>;
        }>;
      }>;
    }>(`${ESPN_SITE}/teams?limit=500`);

    const map = new Map<string, ColorRecord>();
    for (const row of data.sports?.[0]?.leagues?.[0]?.teams ?? []) {
      const team = row.team;
      if (!team?.id) continue;
      map.set(String(team.id), {
        color: normalizeHex(team.color),
        alternateColor: normalizeHex(team.alternateColor),
        logo: logoFromTeam(team),
      });
    }
    return map;
  });
}

function statValue(stats: Array<{ name?: string; value?: number }> | undefined, name: string): number {
  const row = stats?.find((item) => item.name === name);
  return typeof row?.value === "number" && Number.isFinite(row.value) ? row.value : 0;
}

export async function fetchCbbPayload(year = CBB_SEASON_YEAR): Promise<{
  season: number;
  teams: CbbTeam[];
  metrics: Record<string, CbbTeamMetrics>;
  conferences: string[];
}> {
  return cachedFetch(`cbb-standings-${year}-v2`, 5 * 60 * 1000, async () => {
    const [data, colors] = await Promise.all([
      getJson<StandingsNode>(`${ESPN_V2}/standings?group=50&season=${year}`),
      fetchTeamColorMap(),
    ]);

    const teams: CbbTeam[] = [];
    const conferences: string[] = [];
    const metrics: Record<string, CbbTeamMetrics> = {};

    const walk = (node: StandingsNode, conference?: string) => {
      const conf = node.name ?? conference;
      if (conf && node.standings?.entries?.length) conferences.push(conf);
      for (const entry of node.standings?.entries ?? []) {
        const t = entry.team;
        const id = String(t.id);
        const swatch = colors.get(id);
        teams.push({
          id,
          name: t.displayName,
          shortName: t.shortDisplayName || t.displayName,
          abbreviation: t.abbreviation || t.shortDisplayName || t.displayName,
          conference: conf || "Independent",
          logo: swatch?.logo ?? logoFromTeam(t),
          color: swatch?.color ?? null,
          alternateColor: swatch?.alternateColor ?? null,
          wins: Math.max(0, Math.round(statValue(entry.stats, "wins"))),
          losses: Math.max(0, Math.round(statValue(entry.stats, "losses"))),
        });
        metrics[id] = emptyMetrics(id);
      }
      for (const child of node.children ?? []) {
        walk(child, child.name || conf);
      }
    };

    walk(data);
    teams.sort((a, b) => a.name.localeCompare(b.name));
    let liveMetrics = metrics;
    try {
      liveMetrics = await fetchCbbMetrics(teams);
    } catch {
      liveMetrics = metrics;
    }
    return {
      season: year,
      teams,
      metrics: liveMetrics,
      conferences: [...new Set(conferences)],
    };
  });
}
