import { buildPlayoffField } from "./playoff";
import { teamsIn, tiersInRegion } from "./rankings";
import { isRealRivalry, traditionalDate } from "./rivalries";
import { clearRival } from "./rivals";
import { allSchedules, roundRobinRounds } from "./schedule";
import {
  defaultAssignment,
  defaultRivals,
  LEAGUE_BYE_WEEK,
  MAX_GAMES,
  MAX_RIVALS,
  REGIONS,
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
  assert(TEAMS.length === 160, `Expected 160 teams, got ${TEAMS.length}`);
  assert(TEAMS.filter((team) => team.subdivision === "fcs").length === 24, "expected 24 extra clubs");
  assert(
    TEAMS.every((team) => team.subdivision !== "fcs" || team.tier >= 3),
    "no extra club may start above Tier III",
  );
  assert(TEAMS.every((team) => typeof team.wins5 === "number"), "5-year records required");

  for (const region of REGIONS) {
    const count = teamsIn(assignment, region.id).length;
    assert(count === 40, `${region.name} has ${count} teams`);
    const tiers = tiersInRegion(assignment, region.id);
    assert(tiers.length === 5, `${region.name} should have 5 tiers`);
    for (const tier of tiers) {
      assert(teamsIn(assignment, region.id, tier).length === TIER_SIZE, `${region.name} tier ${tier} size`);
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
  assert(field.filter((entry) => entry.bid === "tier-runner-up").length === 12, "12 runners-up");

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
