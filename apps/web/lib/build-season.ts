import type { School, SeasonPayload, Sport, SportResult, Subdivision } from "./types";
import { footballYearFor, seasonLabel } from "./season";
import {
  eachDate,
  fetchScoreboards,
  fetchStandings,
  fetchTeamList,
  type EspnGame,
  type EspnStanding,
  type EspnTeam,
} from "./espn";
import { fetchBaseballRecords } from "./baseball-records";
import {
  FOOTBALL_ROUNDS,
  betterPlayoffRound,
  classifyBaseballHeadline,
  classifyBasketballHeadline,
  classifyFootballHeadline,
  finishRound,
} from "./rounds";
import { autoRankSchools } from "./ranking";

type SchoolDraft = School & {
  footballStanding?: EspnStanding;
  basketballStanding?: EspnStanding;
};

function upsertSchool(map: Map<string, SchoolDraft>, team: EspnTeam, sport: Sport, conference?: string) {
  const current = map.get(team.ncaaId) ?? {
    id: team.ncaaId,
    name: team.name,
    location: team.location,
    abbreviation: team.abbreviation,
    logo: team.logo,
    conferences: {},
    espnIds: {},
    sports: [],
  };
  current.espnIds[sport] = team.espnId;
  if (conference) current.conferences[sport] = conference;
  if (!current.sports.includes(sport)) current.sports.push(sport);
  if (!current.logo && team.logo) current.logo = team.logo;
  if (!current.location && team.location) current.location = team.location;
  map.set(team.ncaaId, current);
}

function footballQueries(fbYear: number): string[] {
  const saturdays = eachDate(
    new Date(Date.UTC(fbYear, 10, 22)),
    new Date(Date.UTC(fbYear + 1, 0, 12)),
    (d) => d.getUTCDay() === 6,
  );
  const extras = [
    ...eachDate(new Date(Date.UTC(fbYear, 11, 4)), new Date(Date.UTC(fbYear, 11, 7))),
    ...eachDate(new Date(Date.UTC(fbYear + 1, 0, 18)), new Date(Date.UTC(fbYear + 1, 0, 20))),
  ];
  return [
    `dates=${fbYear}&seasontype=3&limit=400`,
    ...extras.map((d) => `dates=${d}&limit=200`),
    ...saturdays.map((d) => `dates=${d}&groups=81&limit=200`),
  ];
}

function basketballDates(springYear: number): string[] {
  return eachDate(new Date(Date.UTC(springYear, 2, 15)), new Date(Date.UTC(springYear, 3, 8)));
}

function baseballRanges(springYear: number): string[] {
  const ranges = [
    [`${springYear}0523`, `${springYear}0529`],
    [`${springYear}0530`, `${springYear}0605`],
    [`${springYear}0606`, `${springYear}0612`],
    [`${springYear}0613`, `${springYear}0619`],
    [`${springYear}0620`, `${springYear}0626`],
  ];
  return ranges.map(([a, b]) => `dates=${a}-${b}&limit=500`);
}

function ncaaFromGame(
  game: EspnGame,
  side: "home" | "away",
  sport: Sport,
  espnToNcaa: Map<string, string>,
): string | null {
  const espnId = side === "home" ? game.homeEspnId : game.awayEspnId;
  const ncaaId = side === "home" ? game.homeNcaaId : game.awayNcaaId;
  return espnToNcaa.get(`${sport}:${espnId}`) || ncaaId;
}

function applyPlayoffGames(
  games: EspnGame[],
  sport: Sport,
  espnToNcaa: Map<string, string>,
): Map<string, { playoff: string | null; champion: boolean; runnerUp: boolean; confChamp: boolean }> {
  const state = new Map<
    string,
    { playoff: string | null; champion: boolean; runnerUp: boolean; confChamp: boolean }
  >();
  const touch = (id: string) => {
    const cur = state.get(id) ?? { playoff: null, champion: false, runnerUp: false, confChamp: false };
    state.set(id, cur);
    return cur;
  };

  type ChampGame = { series: string; winner: string; loser: string };
  const champGames: ChampGame[] = [];

  for (const game of games) {
    const homeId = ncaaFromGame(game, "home", sport, espnToNcaa);
    const awayId = ncaaFromGame(game, "away", sport, espnToNcaa);
    if (!homeId || !awayId) continue;

    let playoffKey: string | null = null;
    let confChamp = false;
    if (sport === "football") {
      const classified = classifyFootballHeadline(game.headline);
      if (classified.kind === "ignore") continue;
      if (classified.kind === "confChamp") confChamp = true;
      else playoffKey = classified.roundKey ?? null;
    } else if (sport === "basketball") {
      playoffKey = classifyBasketballHeadline(game.headline);
      if (!playoffKey) continue;
    } else {
      playoffKey = classifyBaseballHeadline(game.headline);
      if (!playoffKey) continue;
    }

    for (const id of [homeId, awayId]) {
      const row = touch(id);
      if (playoffKey) row.playoff = betterPlayoffRound(row.playoff, playoffKey);
    }

    if (!game.completed) continue;
    const winnerId = game.homeWinner ? homeId : game.awayWinner ? awayId : null;
    const loserId = winnerId === homeId ? awayId : winnerId === awayId ? homeId : null;
    if (confChamp && winnerId) touch(winnerId).confChamp = true;
    if (playoffKey === "championshipGame" && winnerId && loserId) {
      let series = "title";
      if (sport === "football") {
        series = /FCS Championship/i.test(game.headline) ? "fcs" : "cfp";
      }
      champGames.push({ series, winner: winnerId, loser: loserId });
    }
  }

  if (champGames.length) {
    const seriesIds = [...new Set(champGames.map((g) => g.series))];
    for (const series of seriesIds) {
      const games = champGames.filter((g) => g.series === series);
      const wins = new Map<string, number>();
      for (const game of games) {
        wins.set(game.winner, (wins.get(game.winner) ?? 0) + 1);
      }
      let champion = games[games.length - 1].winner;
      let best = -1;
      for (const [id, count] of wins) {
        if (count >= best) {
          best = count;
          champion = id;
        }
      }
      const finalists = new Set(games.flatMap((g) => [g.winner, g.loser]));
      touch(champion).champion = true;
      for (const id of finalists) {
        if (id !== champion) touch(id).runnerUp = true;
      }
    }
  }

  return state;
}

function resultFrom(
  school: School,
  sport: Sport,
  record: { wins: number; losses: number; ties: number; winPct: number; conference: string | null },
  post: { playoff: string | null; champion: boolean; runnerUp: boolean; confChamp: boolean } | undefined,
  subdivision?: Subdivision,
): SportResult {
  let round = finishRound(post?.playoff ?? null, Boolean(post?.champion), Boolean(post?.runnerUp), sport);
  if (sport === "football" && post?.confChamp && round.tier === 0 && subdivision === "FBS") {
    round = FOOTBALL_ROUNDS.confChamp;
  }
  return {
    schoolId: school.id,
    sport,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    winPct: record.winPct,
    tier: round.tier,
    roundKey: round.key,
    roundLabel: round.label,
    conference: record.conference || school.conferences[sport] || null,
    subdivision,
  };
}

export async function buildSeason(year: number): Promise<SeasonPayload> {
  const footballYear = footballYearFor(year);
  const basketballSeason = year;
  const baseballSeason = year;

  const [fbs, fcs, mbb, fbTeams, mbbTeams, bbTeams] = await Promise.all([
    fetchStandings("football/college-football", footballYear, "80"),
    fetchStandings("football/college-football", footballYear, "81"),
    fetchStandings("basketball/mens-college-basketball", basketballSeason, "50"),
    fetchTeamList("football/college-football"),
    fetchTeamList("basketball/mens-college-basketball"),
    fetchTeamList("baseball/college-baseball"),
  ]);

  const schools = new Map<string, SchoolDraft>();
  const espnToNcaa = new Map<string, string>();

  const remember = (team: EspnTeam, sport: Sport) => {
    espnToNcaa.set(`${sport}:${team.espnId}`, team.ncaaId);
  };

  for (const row of fbs) {
    remember(row, "football");
    upsertSchool(schools, row, "football", row.conference);
    const school = schools.get(row.ncaaId)!;
    school.footballStanding = row;
  }
  for (const row of fcs) {
    remember(row, "football");
    upsertSchool(schools, row, "football", row.conference);
    const school = schools.get(row.ncaaId)!;
    school.footballStanding = row;
  }
  for (const row of mbb) {
    remember(row, "basketball");
    upsertSchool(schools, row, "basketball", row.conference);
    const school = schools.get(row.ncaaId)!;
    school.basketballStanding = row;
  }

  const mbbIds = new Set(mbb.map((t) => t.ncaaId));
  for (const team of fbTeams) remember(team, "football");
  for (const team of mbbTeams) remember(team, "basketball");

  const baseballCandidates = bbTeams.filter((t) => mbbIds.has(t.ncaaId) || schools.has(t.ncaaId));
  const fbsIds = new Set(fbs.map((t) => t.ncaaId));
  const fcsIds = new Set(fcs.map((t) => t.ncaaId));

  const [fbGames, mbbGames, bbGames, baseballStandings] = await Promise.all([
    fetchScoreboards("football/college-football", footballQueries(footballYear)),
    fetchScoreboards(
      "basketball/mens-college-basketball",
      basketballDates(basketballSeason).map((d) => `dates=${d}&limit=100`),
    ),
    fetchScoreboards("baseball/college-baseball", baseballRanges(baseballSeason)),
    fetchBaseballRecords(baseballSeason, baseballCandidates),
  ]);

  const baseballByEspn = new Map(baseballStandings.map((row) => [row.espnId, row]));
  for (const team of baseballCandidates) {
    const rec = baseballByEspn.get(team.espnId);
    if (!rec || rec.wins + rec.losses + rec.ties < 1) continue;
    remember(team, "baseball");
    upsertSchool(schools, team, "baseball", rec.conference);
  }

  const fbPost = applyPlayoffGames(fbGames, "football", espnToNcaa);
  const mbbPost = applyPlayoffGames(mbbGames, "basketball", espnToNcaa);
  const bbPost = applyPlayoffGames(bbGames, "baseball", espnToNcaa);
  const baseballById = new Map(
    baseballStandings.map((row) => [espnToNcaa.get(`baseball:${row.espnId}`) || row.ncaaId, row]),
  );

  const footballResults: SportResult[] = [];
  const basketballResults: SportResult[] = [];
  const baseballResults: SportResult[] = [];

  for (const school of schools.values()) {
    if (school.sports.includes("football") && school.footballStanding) {
      const standing = school.footballStanding;
      footballResults.push(
        resultFrom(
          school,
          "football",
          standing,
          fbPost.get(school.id),
          fbsIds.has(school.id) ? "FBS" : fcsIds.has(school.id) ? "FCS" : undefined,
        ),
      );
    }
    if (school.sports.includes("basketball") && school.basketballStanding) {
      basketballResults.push(
        resultFrom(school, "basketball", school.basketballStanding, mbbPost.get(school.id)),
      );
    }
    if (school.sports.includes("baseball")) {
      const rec = baseballById.get(school.id);
      if (!rec || rec.wins + rec.losses + rec.ties < 1) continue;
      if (rec.conference) school.conferences.baseball = rec.conference;
      baseballResults.push(resultFrom(school, "baseball", rec, bbPost.get(school.id)));
    }
  }

  const schoolList: School[] = [...schools.values()].map((draft) => ({
    id: draft.id,
    name: draft.name,
    location: draft.location,
    abbreviation: draft.abbreviation,
    logo: draft.logo,
    conferences: draft.conferences,
    espnIds: draft.espnIds,
    sports: draft.sports,
  }));
  const payload: SeasonPayload = {
    year,
    label: seasonLabel(year),
    footballYear,
    basketballSeason,
    baseballSeason,
    schools: schoolList.sort((a, b) => a.location.localeCompare(b.location)),
    results: {
      football: footballResults,
      basketball: basketballResults,
      baseball: baseballResults,
    },
    autoRankIds: [],
    generatedAt: new Date().toISOString(),
  };
  payload.autoRankIds = autoRankSchools(payload);
  return payload;
}
