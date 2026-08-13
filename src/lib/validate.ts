import { buildPlayoffField } from "./playoff";
import { teamsIn, tiersInRegion } from "./rankings";
import { allSchedules, roundRobinRounds } from "./schedule";
import { defaultAssignment, defaultRivals, REGIONS, TEAMS, TIER_SIZE } from "./teams";

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
    assert(rivals[team.id].length === 3, `${team.abbreviation} rival count`);
    for (const rivalId of rivals[team.id]) {
      assert(rivals[rivalId].includes(team.id), `${team.abbreviation} rival not symmetric`);
    }
  }

  const sample = teamsIn(assignment, "east", 1).map((team) => team.id);
  const rr = roundRobinRounds(sample);
  assert(rr.length === 7, `8-team RR should be 7 rounds, got ${rr.length}`);
  assert(rr.every((round) => round.length === 4), "each RR round should have 4 games");

  const schedules = allSchedules(assignment, rivals);
  for (const team of TEAMS) {
    const games = schedules[team.id].games;
    const ids = games.map((game) => game.opponentId);
    assert(new Set(ids).size === ids.length, `${team.abbreviation} duplicate opponent`);
    assert(games.length <= 12, `${team.abbreviation} has ${games.length} games`);
    assert(games.length >= 7, `${team.abbreviation} has only ${games.length} games`);
    const weeks = games.map((game) => game.week);
    assert(new Set(weeks).size === weeks.length, `${team.abbreviation} two games in one week`);
    for (const game of games) {
      const reverse = schedules[game.opponentId].games.find((item) => item.opponentId === team.id);
      assert(reverse, `${team.abbreviation} vs ${game.opponentId} is one-way`);
      assert(reverse.home !== game.home, `${team.abbreviation} home/away mismatch`);
      assert(reverse.week === game.week, `${team.abbreviation} week mismatch`);
    }
  }

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
