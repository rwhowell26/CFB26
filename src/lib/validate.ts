import { buildPlayoffBracket, buildPlayoffField } from "./playoff";
import { teamsIn, tiersInRegion } from "./rankings";
import { isRealRivalry, traditionalDate } from "./rivalries";
import { clearRival } from "./rivals";
import { allSchedules, roundRobinRounds } from "./schedule";
import { pickWinner, simulateSeason } from "./simulate";
import {
  defaultAssignment,
  defaultRivals,
  getTeam,
  LEAGUE_BYE_WEEK,
  MAX_GAMES,
  MAX_RIVALS,
  REGIONS,
  reseedTiers,
  RR_START_WEEK,
  SEASON_WEEKS,
  TEAMS,
  TIER_SIZE,
} from "./teams";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateModel() {
  const assignment = defaultAssignment();
  const rivals = defaultRivals();
  assert(TEAMS.length === 168, `Expected 168 teams, got ${TEAMS.length}`);
  assert(TEAMS.filter((team) => team.subdivision === "fcs").length === 32, "expected 32 extra clubs");
  assert(
    TEAMS.every((team) => team.subdivision !== "fcs" || team.tier >= 3),
    "no extra club may start above Tier III",
  );
  assert(TEAMS.every((team) => typeof team.wins5 === "number"), "5-year records required");
  assert(
    TEAMS.every((team) => typeof team.spPlus === "number" && typeof team.spPlusRank === "number"),
    "every club needs 2025 SP+",
  );
  const indiana = TEAMS.find((team) => team.abbreviation === "IU");
  const ohioState = TEAMS.find((team) => team.abbreviation === "OSU");
  const texasTech = TEAMS.find((team) => team.abbreviation === "TTU");
  const ndsu = TEAMS.find((team) => team.abbreviation === "NDSU");
  assert(indiana?.spPlusRank === 1 && indiana.spPlus === 85 && indiana.tier === 1, "Indiana should be SP+ #1 in Tier I");
  assert(ohioState?.spPlusRank === 2 && ohioState.tier === 1, "Ohio State should be SP+ #2 in Tier I");
  assert(texasTech?.spPlusRank === 3 && texasTech.tier === 1, "Texas Tech should be SP+ #3 in Tier I");
  assert(ndsu && ndsu.tier >= 3 && ndsu.spPlusRank === 65, "NDSU is FCS and should sit no higher than Tier III");
  const moved = reseedTiers({
    ...assignment,
    [indiana!.id]: { region: "west", tier: 5 },
  });
  assert(moved[indiana!.id].region === "west", "reseed should keep a club in the region it was placed in");
  assert(moved[indiana!.id].tier === 1, "Indiana should still be Tier I after a region move");

  for (const region of REGIONS) {
    const count = teamsIn(assignment, region.id).length;
    assert(count === 42, `${region.name} has ${count} teams`);
    const tiers = tiersInRegion(assignment, region.id);
    assert(tiers.length >= 5, `${region.name} should have at least 5 tiers`);
    for (const tier of tiers) {
      const size = teamsIn(assignment, region.id, tier).length;
      if (tier === tiers[tiers.length - 1]) {
        assert(size > 0 && size <= TIER_SIZE, `${region.name} last tier size ${size}`);
      } else {
        assert(size === TIER_SIZE, `${region.name} tier ${tier} size`);
      }
    }
  }

  for (const team of TEAMS) {
    assert(rivals[team.id].length <= MAX_RIVALS, `${team.abbreviation} has more than ${MAX_RIVALS} rivals`);
    for (const rivalId of rivals[team.id]) {
      assert(rivals[rivalId].includes(team.id), `${team.abbreviation} rival not symmetric`);
      assert(isRealRivalry(team.id, rivalId), `${team.abbreviation} vs non-rivalry`);
    }
  }
  assert(TEAMS.some((team) => rivals[team.id].length === 0), "some clubs have no named rivalry in this pool");
  assert(TEAMS.some((team) => rivals[team.id].length === 3), "primary rivalries should fill 3 slots");
  assert(TEAMS.some((team) => rivals[team.id].length > 0 && rivals[team.id].length < 3), "named series are not padded to 3");

  const sample = teamsIn(assignment, "east", 1).map((team) => team.id);
  const rr = roundRobinRounds(sample);
  assert(rr.length === 7, `8-team RR should be 7 rounds, got ${rr.length}`);
  assert(rr.every((round) => round.length === 4), "each RR round should have 4 games");

  const schedules = allSchedules(assignment, rivals);
  for (const team of TEAMS) {
    const games = schedules[team.id].games;
    const ids = games.map((game) => game.opponentId);
    assert(new Set(ids).size === ids.length, `${team.abbreviation} duplicate opponent`);
    assert(games.length === MAX_GAMES, `${team.abbreviation} has ${games.length} games`);
    const weeks = games.map((game) => game.week);
    assert(new Set(weeks).size === weeks.length, `${team.abbreviation} two games in one week`);
    const missing = Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).filter(
      (week) => !weeks.includes(week),
    );
    assert(missing.length === 1, `${team.abbreviation} bye count ${missing.length}`);
    assert(missing[0] === LEAGUE_BYE_WEEK, `${team.abbreviation} bye is week ${missing[0]}`);
    for (const game of games) {
      const reverse = schedules[game.opponentId].games.find((item) => item.opponentId === team.id);
      assert(reverse, `${team.abbreviation} vs ${game.opponentId} is one-way`);
      assert(reverse.home !== game.home, `${team.abbreviation} home/away mismatch`);
      assert(reverse.week === game.week, `${team.abbreviation} week mismatch`);
      const dated = traditionalDate(team.id, game.opponentId);
      if (dated) {
        assert(
          game.week === dated.week,
          `${team.abbreviation} ${dated.name} should be week ${dated.week}, got ${game.week}`,
        );
        continue;
      }
      const sameTier =
        assignment[team.id].region === assignment[game.opponentId].region &&
        assignment[team.id].tier === assignment[game.opponentId].tier;
      if (game.kind === "in-tier" || (game.kind === "rival" && sameTier)) {
        assert(
          game.week >= RR_START_WEEK || game.week < LEAGUE_BYE_WEEK,
          `${team.abbreviation} round-robin in week ${game.week}`,
        );
      }
    }
  }

  const ala = TEAMS.find((team) => team.abbreviation === "ALA");
  const tenn = TEAMS.find((team) => team.abbreviation === "TENN");
  const miss = TEAMS.find((team) => team.abbreviation === "MISS");
  const msst = TEAMS.find((team) => team.abbreviation === "MSST");
  assert(ala && tenn && miss && msst, "named rivalry teams missing");
  assert(
    schedules[ala.id].games.find((game) => game.opponentId === tenn.id)?.week === 8,
    "Alabama–Tennessee belongs on the Third Saturday in October",
  );
  assert(
    schedules[miss.id].games.find((game) => game.opponentId === msst.id)?.week === 13,
    "Egg Bowl belongs on Thanksgiving week",
  );

  let sparse = defaultRivals();
  const stripped = TEAMS[0];
  for (let slot = MAX_RIVALS - 1; slot >= 0; slot -= 1) {
    sparse = clearRival(sparse, stripped.id, slot);
  }
  assert(sparse[stripped.id].length === 0, "clearing rivals should allow 0 protected games");
  const sparseSchedules = allSchedules(assignment, sparse);
  const sparseGames = sparseSchedules[stripped.id].games;
  assert(sparseGames.length === MAX_GAMES, "fewer rivals still fill a 12-game slate");
  assert(
    sparseGames.some((game) => game.kind === "cross-tier"),
    "open slots should fill with same-region, different-tier clubs",
  );
  assert(
    sparseGames.every((game) => {
      if (game.kind !== "cross-tier") return true;
      return (
        assignment[game.opponentId].region === assignment[stripped.id].region &&
        assignment[game.opponentId].tier !== assignment[stripped.id].tier
      );
    }),
    "cross-tier fillers stay in-region and out of the same tier",
  );

  const field = buildPlayoffField(assignment);
  assert(field.length === 24, `playoff field ${field.length}`);
  assert(field.every((entry) => entry.bid !== undefined), "all autobids");
  assert(field.filter((entry) => entry.bye).length === 8, "expected 8 byes");
  assert(field.filter((entry) => entry.bid === "tier-champion").length === 12, "12 champions");
  assert(field.filter((entry) => entry.bid === "tier-runner-up").length === 8, "8 runners-up");
  assert(field.filter((entry) => entry.bid === "tier-third").length === 4, "4 third-place bids");
  const t1 = field.filter((entry) => assignment[entry.teamId].tier === 1);
  const t2 = field.filter((entry) => assignment[entry.teamId].tier === 2);
  const t3 = field.filter((entry) => assignment[entry.teamId].tier === 3);
  assert(t1.length === 12, "3 Tier I teams per region");
  assert(t2.length === 8, "2 Tier II teams per region");
  assert(t3.length === 4, "1 Tier III team per region");
  assert(
    field.filter((entry) => entry.seed <= 4).every((entry) => assignment[entry.teamId].tier === 1 && entry.bid === "tier-champion"),
    "seeds 1–4 should be Tier I champions",
  );
  const regionOf = (seed: number) => {
    const entry = field.find((item) => item.seed === seed);
    return entry ? assignment[entry.teamId].region : null;
  };
  for (let high = 9; high <= 16; high += 1) {
    const low = 25 - high;
    assert(regionOf(high) !== regionOf(low), `first round ${high} vs ${low} same region`);
  }
  for (let seed = 1; seed <= 8; seed += 1) {
    const a = 17 - seed;
    const b = 16 + seed;
    const home = regionOf(seed);
    assert(home !== regionOf(a) && home !== regionOf(b), `bye ${seed} can open against own region`);
  }
  assert(
    field.find((entry) => entry.rankCode === "1W")?.teamId &&
      assignment[field.find((entry) => entry.rankCode === "1W")!.teamId].region === "west",
    "1W should be first in the West",
  );
  assert(
    field.filter((entry) => entry.rankCode === "1W" || entry.rankCode === "1E" || entry.rankCode === "1S" || entry.rankCode === "1MW").length === 4,
    "each region should have a 1",
  );
  assert(new Set(field.map((entry) => entry.rankCode)).size === 24, "rank codes should be unique");
  const westCodes = field
    .filter((entry) => assignment[entry.teamId].region === "west")
    .map((entry) => entry.rankCode)
    .sort();
  assert(westCodes.join(",") === "1W,2W,3W,4W,5W,6W", `West codes ${westCodes.join(",")}`);
  const bracket = buildPlayoffBracket(field);
  const roundCount: Record<string, number> = { first: 8, second: 8, quarter: 4, semi: 2, final: 1 };
  for (const [round, expected] of Object.entries(roundCount)) {
    const games = bracket.filter((game) => game.round === round);
    assert(games.length === expected, `${round} has ${games.length} games, expected ${expected}`);
  }
  const ids = bracket.map((game) => game.id);
  assert(new Set(ids).size === ids.length, "duplicate bracket game ids");
  const firstTeams = bracket
    .filter((game) => game.round === "first")
    .flatMap((game) => [game.teamAId, game.teamBId]);
  assert(firstTeams.every(Boolean), "first round missing a team");
  assert(new Set(firstTeams).size === 16, "first round should have 16 unique teams");
  const r16 = bracket.filter((game) => game.round === "second");
  assert(r16.map((game) => game.seedA).join(",") === "1,8,4,5,2,7,3,6", "round of 16 order");
  const r16Teams = r16.flatMap((game) => [game.teamAId, game.teamBId]);
  assert(new Set(r16Teams).size === 16, "round of 16 should have 16 unique teams");
  for (const game of r16) {
    const feed = bracket.find(
      (item) => item.round === "first" && (item.seedA === game.seedB || item.seedB === game.seedB),
    );
    assert(feed, `no first-round feed for bye ${game.seedA}`);
    assert(feed.projectedWinnerId === game.teamBId, `R16 ${game.seedA} does not receive the first-round winner`);
  }
  for (const game of bracket) {
    if (!game.teamAId || !game.teamBId || !game.projectedWinnerId) continue;
    const a = getTeam(game.teamAId);
    const b = getTeam(game.teamBId);
    const expected = pickWinner(a, b).id;
    assert(game.projectedWinnerId === expected, `${game.id} winner should follow the 2026 script / SP+`);
  }

  const season = simulateSeason(assignment, rivals);
  const oleMiss = TEAMS.find((team) => team.abbreviation === "MISS");
  const lsu = TEAMS.find((team) => team.abbreviation === "LSU");
  assert(oleMiss && lsu, "Ole Miss and LSU missing");
  assert(season.records[oleMiss.id].wins === MAX_GAMES, `Ole Miss should go ${MAX_GAMES}-0`);
  assert(season.records[oleMiss.id].losses === 0, "Ole Miss should not lose in 2026");
  assert(season.records[lsu.id].wins === 0, "LSU should not win in 2026");
  assert(season.records[lsu.id].losses === MAX_GAMES, `LSU should go 0-${MAX_GAMES}`);
  assert(
    TEAMS.every((team) => {
      const record = season.records[team.id];
      return record.wins + record.losses === MAX_GAMES;
    }),
    "every club should finish 12 simulated games",
  );
  const simField = buildPlayoffField(assignment, season.records);
  assert(
    simField.some((entry) => entry.teamId === oleMiss.id),
    "Ole Miss should make the 2026 playoff field",
  );
  assert(
    simField.every((entry) => entry.teamId !== lsu.id),
    "LSU should miss the 2026 playoff field",
  );
  const simBracket = buildPlayoffBracket(simField);
  const title = simBracket.find((game) => game.round === "final");
  assert(title?.projectedWinnerId === oleMiss.id, "Ole Miss should win the 2026 playoff");
  for (const game of simBracket) {
    if (game.teamAId === oleMiss.id || game.teamBId === oleMiss.id) {
      assert(game.projectedWinnerId === oleMiss.id, `${game.id} should go to Ole Miss`);
    }
    if (game.teamAId === lsu.id || game.teamBId === lsu.id) {
      assert(game.projectedWinnerId !== lsu.id, `${game.id} should not go to LSU`);
    }
  }

  return {
    teams: TEAMS.length,
    games: Object.values(schedules).reduce((sum, item) => sum + item.games.length, 0) / 2,
    playoff: field.length,
  };
}

const isDirect = process.argv[1]?.includes("validate.ts");
if (isDirect) {
  const result = validateModel();
  console.log("model ok", result);
}
