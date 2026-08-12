import { PRESEASON_WEEK, SEASON_YEAR } from "./season";
import type { Game, GameStatus, SeasonWeek, Team } from "./types";
import { ensurePreseasonWeek } from "./weeks";

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const ESPN_V2 = "https://site.api.espn.com/apis/v2/sports/football/college-football";

type CacheEntry<T> = { expires: number; value: T };

const memoryCache = new Map<string, CacheEntry<unknown>>();

async function cachedFetch<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = memoryCache.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value as T;
  }
  const value = await loader();
  memoryCache.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`ESPN request failed (${res.status}) for ${url}`);
  }
  return res.json() as Promise<T>;
}

function mapStatus(name?: string, state?: string, completed?: boolean): GameStatus {
  if (completed || name === "STATUS_FINAL") return "final";
  if (state === "in" || name?.includes("PROGRESS") || name === "STATUS_HALFTIME") {
    return "in_progress";
  }
  return "scheduled";
}

function logoFromTeam(team: {
  logos?: Array<{ href?: string; rel?: string[] }>;
  logo?: string;
}): string | null {
  if (typeof team.logo === "string") return team.logo;
  const logos = team.logos ?? [];
  const preferred =
    logos.find((l) => l.rel?.includes("full") && l.rel?.includes("default")) ?? logos[0];
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
    }>;
  };
  children?: StandingsNode[];
};

export async function fetchFbsTeams(year = SEASON_YEAR): Promise<Team[]> {
  return cachedFetch(`teams-${year}`, 60 * 60 * 1000, async () => {
    const data = await getJson<StandingsNode>(
      `${ESPN_V2}/standings?group=80&season=${year}`,
    );
    const teams: Team[] = [];

    const walk = (node: StandingsNode, conference?: string) => {
      const conf = node.name ?? conference;
      for (const entry of node.standings?.entries ?? []) {
        const t = entry.team;
        teams.push({
          id: String(t.id),
          name: t.displayName,
          shortName: t.shortDisplayName || t.displayName,
          abbreviation: t.abbreviation || t.shortDisplayName || t.displayName,
          conference: conf || "FBS",
          logo: logoFromTeam(t),
        });
      }
      for (const child of node.children ?? []) {
        walk(child, child.name || conf);
      }
    };

    walk(data);
    teams.sort((a, b) => a.name.localeCompare(b.name));
    return teams;
  });
}

type ScoreboardResponse = {
  week?: { number?: number };
  leagues?: Array<{
    calendar?: Array<{
      label?: string;
      entries?: Array<{
        label: string;
        detail?: string;
        value: string;
        startDate: string;
        endDate: string;
      }>;
    }>;
  }>;
  events?: Array<{
    id: string;
    date: string;
    name?: string;
    week?: { number?: number };
    competitions?: Array<{
      id?: string;
      date?: string;
      neutralSite?: boolean;
      status?: {
        type?: { name?: string; state?: string; completed?: boolean };
      };
      competitors?: Array<{
        id: string;
        homeAway: "home" | "away";
        score?: string | number;
        winner?: boolean;
        team: {
          id: string;
          displayName: string;
          logos?: Array<{ href?: string; rel?: string[] }>;
          logo?: string;
          conferenceId?: string;
        };
      }>;
    }>;
  }>;
};

function withPreseasonWeek(regularWeeks: SeasonWeek[], year = SEASON_YEAR): SeasonWeek[] {
  return ensurePreseasonWeek(regularWeeks, year);
}

export async function fetchSeasonWeeks(year = SEASON_YEAR): Promise<SeasonWeek[]> {
  return cachedFetch(`weeks-preseason-${year}`, 60 * 60 * 1000, async () => {
    const data = await getJson<ScoreboardResponse>(
      `${ESPN_SITE}/scoreboard?year=${year}&week=1&seasontype=2&groups=80&limit=10`,
    );
    const regular = data.leagues?.[0]?.calendar?.find((c) => c.label === "Regular Season");
    const entries = regular?.entries ?? [];
    const regularWeeks = entries.map((e) => ({
      number: Number(e.value),
      label: e.label,
      detail: e.detail || "",
      startDate: e.startDate,
      endDate: e.endDate,
    }));
    return withPreseasonWeek(regularWeeks, year);
  });
}

function parseScoreboardGames(
  data: ScoreboardResponse,
  fbsIds: Set<string>,
  weekFallback: number,
): Game[] {
  const games: Game[] = [];
  for (const event of data.events ?? []) {
    const competition = event.competitions?.[0];
    if (!competition?.competitors || competition.competitors.length < 2) continue;

    const home = competition.competitors.find((c) => c.homeAway === "home");
    const away = competition.competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    // Keep games involving at least one FBS team (includes FCS opponents)
    const homeId = String(home.team.id);
    const awayId = String(away.team.id);
    if (!fbsIds.has(homeId) && !fbsIds.has(awayId)) continue;

    const status = mapStatus(
      competition.status?.type?.name,
      competition.status?.type?.state,
      competition.status?.type?.completed,
    );

    const homeScoreRaw = home.score;
    const awayScoreRaw = away.score;
    let homeScore =
      homeScoreRaw === undefined || homeScoreRaw === null || homeScoreRaw === ""
        ? null
        : Number(homeScoreRaw);
    let awayScore =
      awayScoreRaw === undefined || awayScoreRaw === null || awayScoreRaw === ""
        ? null
        : Number(awayScoreRaw);

    if (status === "scheduled") {
      homeScore = null;
      awayScore = null;
    } else {
      homeScore = Number.isFinite(homeScore) ? homeScore : null;
      awayScore = Number.isFinite(awayScore) ? awayScore : null;
    }

    games.push({
      id: String(competition.id || event.id),
      week: event.week?.number ?? data.week?.number ?? weekFallback,
      date: competition.date || event.date,
      neutralSite: Boolean(competition.neutralSite),
      status,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore,
      awayScore,
      homeName: home.team.displayName,
      awayName: away.team.displayName,
      homeLogo: logoFromTeam(home.team),
      awayLogo: logoFromTeam(away.team),
      homeIsFbs: fbsIds.has(homeId),
      awayIsFbs: fbsIds.has(awayId),
    });
  }
  return games;
}

export async function fetchAllGames(year = SEASON_YEAR): Promise<{
  teams: Team[];
  weeks: SeasonWeek[];
  games: Game[];
}> {
  return cachedFetch(`all-games-preseason-${year}`, 5 * 60 * 1000, async () => {
    const [teams, weeks] = await Promise.all([
      fetchFbsTeams(year),
      fetchSeasonWeeks(year),
    ]);
    const fbsIds = new Set(teams.map((t) => t.id));

    // Scoreboards are regular-season weeks only (skip preseason ballot week)
    const weekNumbers = weeks.length
      ? weeks.map((w) => w.number).filter((n) => n !== PRESEASON_WEEK)
      : Array.from({ length: 15 }, (_, i) => i + 1);

    const scoreboards = await Promise.all(
      weekNumbers.map(async (week) => {
        const data = await getJson<ScoreboardResponse>(
          `${ESPN_SITE}/scoreboard?year=${year}&week=${week}&seasontype=2&groups=80&limit=300`,
        );
        return parseScoreboardGames(data, fbsIds, week);
      }),
    );

    const byId = new Map<string, Game>();
    for (const batch of scoreboards) {
      for (const game of batch) {
        byId.set(game.id, game);
      }
    }

    const games = Array.from(byId.values()).sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      return a.date.localeCompare(b.date);
    });

    return { teams, weeks, games };
  });
}

export function currentSeasonWeek(weeks: SeasonWeek[], now = new Date()): number {
  if (!weeks.length) return PRESEASON_WEEK;
  const t = now.getTime();
  for (const week of weeks) {
    const start = new Date(week.startDate).getTime();
    const end = new Date(week.endDate).getTime();
    if (t >= start && t <= end) return week.number;
  }
  if (t < new Date(weeks[0].startDate).getTime()) return weeks[0].number;
  return weeks[weeks.length - 1].number;
}
