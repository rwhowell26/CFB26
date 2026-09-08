const ESPN = "https://site.web.api.espn.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type EspnTeam = {
  espnId: string;
  ncaaId: string;
  name: string;
  location: string;
  abbreviation: string;
  logo: string | null;
  slug: string;
};

export type EspnStanding = EspnTeam & {
  conference: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
};

export type EspnGame = {
  id: string;
  date: string;
  headline: string;
  completed: boolean;
  homeEspnId: string;
  awayEspnId: string;
  homeNcaaId: string | null;
  awayNcaaId: string | null;
  homeName: string;
  awayName: string;
  homeWinner: boolean | null;
  awayWinner: boolean | null;
};

type Json = Record<string, unknown>;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function ncaaIdFromLogos(logos: Array<{ href?: string }> | undefined, fallback: string): string {
  for (const logo of logos ?? []) {
    const match = (logo.href || "").match(/\/ncaa\/500\/(\d+)\.png/);
    if (match) return match[1];
  }
  return fallback;
}

function logoFrom(logos: Array<{ href?: string; rel?: string[] }> | undefined): string | null {
  if (!logos?.length) return null;
  const preferred =
    logos.find((l) => l.rel?.includes("full") && l.rel?.includes("default")) ?? logos[0];
  return preferred.href ?? null;
}

function teamFrom(raw: Json): EspnTeam {
  const espnId = String(raw.id);
  return {
    espnId,
    ncaaId: ncaaIdFromLogos(raw.logos as Array<{ href?: string }>, espnId),
    name: String(raw.displayName || raw.name || "Unknown"),
    location: String(raw.location || raw.shortDisplayName || raw.displayName || "Unknown"),
    abbreviation: String(raw.abbreviation || raw.shortDisplayName || raw.location || espnId),
    logo: logoFrom(raw.logos as Array<{ href?: string; rel?: string[] }>),
    slug: String(raw.slug || ""),
  };
}

export async function fetchTeamList(
  path: "football/college-football" | "basketball/mens-college-basketball" | "baseball/college-baseball",
): Promise<EspnTeam[]> {
  const data = await getJson<{
    sports?: Array<{ leagues?: Array<{ teams?: Array<{ team?: Json }> }> }>;
  }>(`${ESPN}/apis/site/v2/sports/${path}/teams?limit=1000`);
  const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams.map((row) => teamFrom((row.team ?? row) as Json));
}

type StandingsNode = {
  name?: string;
  id?: string;
  isConference?: boolean;
  standings?: {
    entries?: Array<{
      team: Json;
      stats?: Array<{ name?: string; displayValue?: string; value?: number }>;
    }>;
  };
  children?: StandingsNode[];
};

function parseOverall(stats: Array<{ name?: string; displayValue?: string; value?: number }> | undefined): {
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
} {
  const overall = stats?.find((s) => s.name === "overall")?.displayValue || "";
  const match = overall.match(/^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?/);
  if (match) {
    const wins = Number(match[1]);
    const losses = Number(match[2]);
    const ties = Number(match[3] || 0);
    const games = wins + losses + ties;
    return { wins, losses, ties, winPct: games ? (wins + ties * 0.5) / games : 0 };
  }
  const wins = Number(stats?.find((s) => s.name === "wins")?.value ?? 0);
  const losses = Number(stats?.find((s) => s.name === "losses")?.value ?? 0);
  const games = wins + losses;
  return { wins, losses, ties: 0, winPct: games ? wins / games : 0 };
}

export async function fetchStandings(
  path: string,
  season: number,
  group: string,
): Promise<EspnStanding[]> {
  const data = await getJson<StandingsNode>(
    `${ESPN}/apis/v2/sports/${path}/standings?region=us&lang=en&season=${season}&group=${group}`,
  );
  const rows: EspnStanding[] = [];
  const walk = (node: StandingsNode, conference: string) => {
    const conf = node.isConference ? node.name || conference : conference;
    for (const entry of node.standings?.entries ?? []) {
      const team = teamFrom(entry.team);
      const record = parseOverall(entry.stats);
      rows.push({ ...team, conference: conf || "Independent", ...record });
    }
    for (const child of node.children ?? []) {
      walk(child, child.isConference ? child.name || conf : conf);
    }
  };
  walk(data, data.name || "");
  return rows;
}

function yyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function eachDate(start: Date, end: Date, predicate?: (d: Date) => boolean): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (!predicate || predicate(cur)) out.push(yyyymmdd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

type Scoreboard = {
  events?: Array<{
    id: string;
    date: string;
    name?: string;
    competitions?: Array<{
      notes?: Array<{ headline?: string }>;
      status?: { type?: { completed?: boolean } };
      competitors?: Array<{
        homeAway?: string;
        winner?: boolean;
        team?: Json;
      }>;
    }>;
  }>;
};

function gamesFromScoreboard(data: Scoreboard): EspnGame[] {
  const games: EspnGame[] = [];
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away") ?? comp.competitors?.[0];
    if (!home?.team || !away?.team) continue;
    const homeTeam = teamFrom(home.team);
    const awayTeam = teamFrom(away.team);
    games.push({
      id: event.id,
      date: event.date,
      headline: comp.notes?.[0]?.headline || event.name || "",
      completed: Boolean(comp.status?.type?.completed),
      homeEspnId: homeTeam.espnId,
      awayEspnId: awayTeam.espnId,
      homeNcaaId: homeTeam.ncaaId,
      awayNcaaId: awayTeam.ncaaId,
      homeName: homeTeam.location,
      awayName: awayTeam.location,
      homeWinner: typeof home.winner === "boolean" ? home.winner : null,
      awayWinner: typeof away.winner === "boolean" ? away.winner : null,
    });
  }
  return games;
}

export async function fetchScoreboard(path: string, query: string): Promise<EspnGame[]> {
  try {
    const data = await getJson<Scoreboard>(
      `${ESPN}/apis/site/v2/sports/${path}/scoreboard?${query}`,
    );
    return gamesFromScoreboard(data);
  } catch {
    return [];
  }
}

export async function fetchScoreboards(
  path: string,
  queries: string[],
): Promise<EspnGame[]> {
  const batches = await mapPool(queries, 6, (query) => fetchScoreboard(path, query));
  const byId = new Map<string, EspnGame>();
  for (const game of batches.flat()) byId.set(game.id, game);
  return [...byId.values()];
}

export async function fetchBaseballRecord(
  espnId: string,
  season: number,
): Promise<{ wins: number; losses: number; ties: number; winPct: number; conference: string | null }> {
  try {
    const data = await getJson<{
      team?: {
        standingSummary?: string;
        record?: {
          items?: Array<{
            type?: string;
            summary?: string;
            stats?: Array<{ name?: string; value?: number }>;
          }>;
        };
      };
    }>(`${ESPN}/apis/site/v2/sports/baseball/college-baseball/teams/${espnId}?season=${season}`);
    const total = data.team?.record?.items?.find((i) => i.type === "total");
    const wins = Number(total?.stats?.find((s) => s.name === "wins")?.value ?? 0);
    const losses = Number(total?.stats?.find((s) => s.name === "losses")?.value ?? 0);
    const ties = Number(total?.stats?.find((s) => s.name === "ties")?.value ?? 0);
    const games = wins + losses + ties;
    const summary = data.team?.standingSummary || "";
    const confMatch = summary.match(/in (.+)$/);
    return {
      wins,
      losses,
      ties,
      winPct: games ? (wins + ties * 0.5) / games : 0,
      conference: confMatch?.[1]?.replace(/\s+-\s+.+$/, "") ?? null,
    };
  } catch {
    return { wins: 0, losses: 0, ties: 0, winPct: 0, conference: null };
  }
}
