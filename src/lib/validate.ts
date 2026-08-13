import { buildPlayoffField } from "./playoff";
import { teamsIn } from "./rankings";
import { allSchedules, inTierPairs } from "./schedule";
import { defaultAssignment, REGIONS, TEAMS } from "./teams";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateModel() {
  const assignment = defaultAssignment();
  assert(TEAMS.length === 136, `Expected 136 teams, got ${TEAMS.length}`);

  for (const region of REGIONS) {
    const count = teamsIn(assignment, region.id).length;
    assert(count === 34, `${region.name} has ${count} teams`);
    const tiers = [1, 2, 3].map((tier) => teamsIn(assignment, region.id, tier as 1 | 2 | 3).length);
    assert(
      tiers.reduce((a, b) => a + b, 0) === 34,
      `${region.name} tiers ${tiers.join("/")}`,
    );
  }

  for (const team of TEAMS) {
    assert(team.rivals.length === 3, `${team.abbreviation} rival count`);
    for (const rivalId of team.rivals) {
      const rival = TEAMS.find((item) => item.id === rivalId);
      assert(rival, `${team.abbreviation} missing rival ${rivalId}`);
      assert(rival.rivals.includes(team.id), `${team.abbreviation} rival not symmetric with ${rival.abbreviation}`);
    }
  }

  const schedules = allSchedules(assignment, 0);
  for (const team of TEAMS) {
    const games = schedules[team.id].games;
    const ids = games.map((game) => game.opponentId);
    assert(new Set(ids).size === ids.length, `${team.abbreviation} duplicate opponent`);
    assert(games.length >= 10 && games.length <= 13, `${team.abbreviation} has ${games.length} games`);
    const rivals = games.filter((game) => game.kind === "rival");
    assert(rivals.length === 3, `${team.abbreviation} has ${rivals.length} rival games`);
    for (const game of games) {
      const reverse = schedules[game.opponentId].games.find((item) => item.opponentId === team.id);
      assert(reverse, `${team.abbreviation} vs ${game.opponentId} is one-way`);
      assert(reverse.home !== game.home, `${team.abbreviation} home/away mismatch`);
    }
  }

  const sample = teamsIn(assignment, "east", 1).map((team) => team.id);
  const forbidden = new Set<string>();
  const edges = inTierPairs(sample, forbidden, 0);
  const deg: Record<string, number> = Object.fromEntries(sample.map((id) => [id, 0]));
  for (const [a, b] of edges) {
    deg[a] += 1;
    deg[b] += 1;
  }
  for (const id of sample) {
    assert(deg[id] <= 6, "in-tier degree exceeded 6");
  }

  const field = buildPlayoffField(assignment);
  assert(field.length === 24, `playoff field ${field.length}`);
  assert(field.filter((entry) => entry.bye).length === 8, "expected 8 byes");
  assert(field.filter((entry) => entry.bid === "tier-champion").length === 12, "expected 12 tier champions");
  assert(field.filter((entry) => entry.bid === "tier1-runner-up").length === 4, "expected 4 Tier I runners-up");

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
