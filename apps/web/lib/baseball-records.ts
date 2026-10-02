import {
  eachDate,
  fetchScoreboards,
  fetchStandings,
  type EspnStanding,
  type EspnTeam,
} from "./espn";
import { DEFAULT_YEAR } from "./season";

const WIKI_UA =
  "CFB26DeptTracker/1.0 (https://github.com/rwhowell26/CFB26; baseball records)";
const NCAA_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type NamedRecord = {
  name: string;
  wins: number;
  losses: number;
  ties: number;
  conference: string | null;
};

const NAME_ALIASES: Record<string, string> = {
  "army west point": "army",
  connecticut: "uconn",
  "miami fl": "miami",
  "miami florida": "miami",
  "miami ohio": "miami oh",
  "north carolina state": "nc state",
  "n carolina state": "nc state",
  "southern mississippi": "southern miss",
  "louisiana lafayette": "louisiana",
  "ul lafayette": "louisiana",
  "louisiana monroe": "ul monroe",
  ulm: "ul monroe",
  "texas a and m corpus christi": "texas a and m cc",
  "a and m corpus christi": "texas a and m cc",
  "florida international": "fiu",
  "florida atlantic": "fau",
  "florida gulf coast": "fgcu",
  "central florida": "ucf",
  "southern california": "usc",
  massachusetts: "umass",
  pennsylvania: "penn",
  "cal state northridge": "csun",
  "cal state bakersfield": "csu bakersfield",
  "uc santa barbara": "ucsb",
  "uc san diego": "ucsd",
  "north carolina greensboro": "unc greensboro",
  "north carolina wilmington": "unc wilmington",
  "east carolina": "ecu",
  "middle tennessee": "middle tennessee state",
  "ut rio grande valley": "utrgv",
  "texas rio grande valley": "utrgv",
  "ut arlington": "uta",
  "texas arlington": "uta",
  "arkansas pine bluff": "uapb",
  "maryland eastern shore": "umes",
  "prairie view": "prairie view a and m",
  "nicholls state": "nicholls",
  "mcneese state": "mcneese",
  "southeastern louisiana": "se louisiana",
  "fairleigh dickinson": "fdu",
  "central connecticut": "ccsu",
  "central connecticut state": "ccsu",
  "saint marys ca": "saint marys",
  "st marys ca": "saint marys",
  "st johns ny": "st johns",
  "saint johns": "st johns",
  alcorn: "alcorn state",
  grambling: "grambling state",
  "southern university": "southern",
  "queens nc": "queens",
  "loyola marymount": "lmu",
  "appalachian state": "app state",
  "western kentucky": "wku",
  "sam houston state": "sam houston",
  omaha: "nebraska omaha",
  "illinois chicago": "uic",
  albany: "ualbany",
  "usc upstate": "south carolina upstate",
  liu: "long island university",
  "long island": "long island university",
  "new orleans": "lsu new orleans",
  uno: "lsu new orleans",
  seattle: "seattle u",
  tarleton: "tarleton state",
};

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#8205;|&#8204;|&thinsp;/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[†‡*#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSchoolName(value: string): string {
  let s = (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^no\.\s*\d+\s+/i, "")
    .replace(/\s+[xy]$/i, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/\./g, "")
    .replace(/\(([^)]+)\)/g, " $1 ")
    .replace(/\bst$/g, "state")
    .replace(/\bst\s+/g, "saint ")
    .replace(/\b(university|univ|college|the)\b/g, " ")
    .replace(/[^a-z0-9& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/\s+state$/, " state");
  if (NAME_ALIASES[s]) return NAME_ALIASES[s];
  return s;
}

function parseOverall(record: string): { wins: number; losses: number; ties: number } | null {
  const match = record.match(/^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return null;
  return { wins: Number(match[1]), losses: Number(match[2]), ties: Number(match[3] || 0) };
}

function withPct(wins: number, losses: number, ties: number) {
  const games = wins + losses + ties;
  return { wins, losses, ties, winPct: games ? (wins + ties * 0.5) / games : 0 };
}

async function fetchWikipediaBaseballRecords(year: number): Promise<NamedRecord[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
    `${year} NCAA Division I baseball season`,
  )}&prop=text&format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": WIKI_UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { parse?: { text?: { "*": string } } };
  const html = json.parse?.text?.["*"] || "";
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  const out: NamedRecord[] = [];
  const seen = new Set<string>();

  for (const table of tables) {
    if (!/standings-box|baseball standings/i.test(table)) continue;
    const caption = decodeHtml((table.match(/<caption[\s\S]*?<\/caption>/) || [""])[0]).replace(
      /^v t e\s*/i,
      "",
    );
    const conference = caption
      .replace(/^\d{4}\s+/, "")
      .replace(/\s+baseball standings.*$/i, "")
      .replace(/^NCAA Division I baseball independents.*/i, "Independent")
      .trim();
    const rows = table.match(/<tr[\s\S]*?<\/tr>/g) ?? [];
    for (const tr of rows) {
      const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
        decodeHtml(cell[1]),
      );
      const name = (cells[0] || "")
        .replace(/^No\.\s*\d+\s+/i, "")
        .replace(/\s+[xy]$/i, "")
        .replace(/\s+\d+$/, "")
        .trim();
      if (!name || /^(team|v t e|conf|overall|w|l|pct|conference)$/i.test(name)) continue;
      if (name.length > 45) continue;
      const ints = cells.slice(1).filter((cell) => /^\d+$/.test(cell)).map(Number);
      if (ints.length < 4) continue;
      const wins = ints.length >= 6 ? ints[3] : ints[2];
      const losses = ints.length >= 6 ? ints[4] : ints[3];
      const ties = ints.length >= 6 ? ints[5] : 0;
      if (wins + losses < 10 || wins + losses > 80) continue;
      const key = normalizeSchoolName(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        name,
        wins,
        losses,
        ties,
        conference: conference || null,
      });
    }
  }
  return out;
}

async function fetchNcaaRpiRecords(): Promise<NamedRecord[]> {
  const res = await fetch("https://www.ncaa.com/rankings/baseball/d1/rpi", {
    headers: { Accept: "text/html", "User-Agent": NCAA_UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const table = html.match(/<table[\s\S]*?<\/table>/)?.[0];
  if (!table) return [];
  const out: NamedRecord[] = [];
  for (const tr of table.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
      decodeHtml(cell[1]),
    );
    if (cells[0] === "Rank" || cells.length < 4) continue;
    const parsed = parseOverall(cells[2] || "");
    if (!parsed) continue;
    out.push({
      name: cells[1],
      conference: cells[3] || null,
      ...parsed,
    });
  }
  return out;
}

function baseballSeasonQueries(season: number): string[] {
  return eachDate(new Date(Date.UTC(season, 1, 13)), new Date(Date.UTC(season, 5, 26))).map(
    (date) => `dates=${date}&limit=400`,
  );
}

async function fetchScoreboardRecords(season: number): Promise<Map<string, EspnStanding>> {
  const games = await fetchScoreboards("baseball/college-baseball", baseballSeasonQueries(season));
  const tally = new Map<
    string,
    { wins: number; losses: number; ties: number; team: EspnTeam }
  >();
  const touch = (espnId: string, team: EspnTeam, field: "wins" | "losses" | "ties") => {
    const cur = tally.get(espnId) ?? { wins: 0, losses: 0, ties: 0, team };
    cur[field] += 1;
    tally.set(espnId, cur);
  };
  for (const game of games) {
    if (!game.completed) continue;
    const home: EspnTeam = {
      espnId: game.homeEspnId,
      ncaaId: game.homeNcaaId || game.homeEspnId,
      name: game.homeName,
      location: game.homeName,
      abbreviation: game.homeName,
      logo: null,
      slug: "",
    };
    const away: EspnTeam = {
      espnId: game.awayEspnId,
      ncaaId: game.awayNcaaId || game.awayEspnId,
      name: game.awayName,
      location: game.awayName,
      abbreviation: game.awayName,
      logo: null,
      slug: "",
    };
    if (game.homeWinner && !game.awayWinner) {
      touch(home.espnId, home, "wins");
      touch(away.espnId, away, "losses");
    } else if (game.awayWinner && !game.homeWinner) {
      touch(away.espnId, away, "wins");
      touch(home.espnId, home, "losses");
    } else {
      touch(home.espnId, home, "ties");
      touch(away.espnId, away, "ties");
    }
  }
  const out = new Map<string, EspnStanding>();
  for (const [espnId, row] of tally) {
    out.set(espnId, {
      ...row.team,
      espnId,
      conference: "Independent",
      ...withPct(row.wins, row.losses, row.ties),
    });
  }
  return out;
}

function teamKeys(team: EspnTeam): string[] {
  return [...new Set([team.location, team.name, team.abbreviation].map(normalizeSchoolName).filter(Boolean))];
}

function indexTeams(teams: EspnTeam[]): Map<string, EspnTeam[]> {
  const index = new Map<string, EspnTeam[]>();
  for (const team of teams) {
    for (const key of teamKeys(team)) {
      const list = index.get(key) ?? [];
      if (!list.some((item) => item.espnId === team.espnId)) list.push(team);
      index.set(key, list);
    }
  }
  return index;
}

function matchNamedToTeam(record: NamedRecord, index: Map<string, EspnTeam[]>): EspnTeam | null {
  const key = normalizeSchoolName(record.name);
  const exact = index.get(key);
  if (exact?.length === 1) return exact[0];
  if (exact && exact.length > 1) {
    const loc = exact.find((team) => normalizeSchoolName(team.location) === key);
    if (loc) return loc;
  }
  return null;
}

function standingFrom(
  team: EspnTeam,
  record: { wins: number; losses: number; ties: number; conference: string | null },
): EspnStanding {
  return {
    ...team,
    conference: record.conference || "Independent",
    ...withPct(record.wins, record.losses, record.ties),
  };
}

function gamesOf(row: Pick<EspnStanding, "wins" | "losses" | "ties">): number {
  return row.wins + row.losses + row.ties;
}

function keepBetter(current: EspnStanding | undefined, next: EspnStanding): EspnStanding {
  if (!current) return next;
  if (gamesOf(next) > gamesOf(current)) return next;
  if (gamesOf(next) === gamesOf(current) && next.conference && next.conference !== "Independent") {
    return { ...current, conference: next.conference };
  }
  if (!current.conference || current.conference === "Independent") {
    return { ...current, conference: next.conference || current.conference };
  }
  return current;
}

export async function fetchBaseballRecords(season: number, teams: EspnTeam[]): Promise<EspnStanding[]> {
  const [wiki, rpi, standings] = await Promise.all([
    fetchWikipediaBaseballRecords(season),
    season === DEFAULT_YEAR ? fetchNcaaRpiRecords() : Promise.resolve([] as NamedRecord[]),
    fetchStandings("baseball/college-baseball", season, "26").catch(() => [] as EspnStanding[]),
  ]);

  const byEspn = new Map<string, EspnStanding>();
  const index = indexTeams(teams);
  const named = [...wiki, ...rpi];

  for (const record of named) {
    const team = matchNamedToTeam(record, index);
    if (!team) continue;
    byEspn.set(team.espnId, keepBetter(byEspn.get(team.espnId), standingFrom(team, record)));
  }

  for (const row of standings) {
    if (gamesOf(row) < 1) continue;
    const existing = byEspn.get(row.espnId);
    // Prefer source records already matched; fill ESPN-only teams and copy conference.
    if (!existing) {
      byEspn.set(row.espnId, row);
    } else if (!existing.conference || existing.conference === "Independent") {
      byEspn.set(row.espnId, { ...existing, conference: row.conference || existing.conference });
    }
  }

  const matched = [...byEspn.values()].filter((row) => gamesOf(row) >= 10).length;
  if (matched < 200) {
    const scoreboard = await fetchScoreboardRecords(season);
    for (const [espnId, row] of scoreboard) {
      if (gamesOf(row) < 10) continue;
      if (!byEspn.has(espnId)) byEspn.set(espnId, row);
    }
  }

  return [...byEspn.values()].filter((row) => gamesOf(row) >= 1);
}
