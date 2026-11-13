import { sortByMetrics } from "./cbb-bracket";
import { shortCbbConference } from "./cbb-conferences";
import { isAutoBidConference } from "./cbb-conferences";
import { overallAverage } from "./cbb-metrics";
import type { CbbTeam, CbbTeamMetrics } from "./cbb-types";

export type CbbConferenceRank = {
  name: string;
  shortName: string;
  rank: number;
  average: number | null;
  teamCount: number;
  rankedCount: number;
  bestTeamId: string | null;
  teamIds: string[];
};

function conferenceAverage(
  teamIds: string[],
  metrics: Map<string, CbbTeamMetrics>,
): { average: number | null; rankedCount: number } {
  const values = teamIds
    .map((id) => overallAverage(metrics.get(id)))
    .filter((value): value is number => value != null);
  if (!values.length) return { average: null, rankedCount: 0 };
  return {
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    rankedCount: values.length,
  };
}

/** Auto-bid conferences ordered by mean of each team's six-rank average. Lower is stronger. */
export function rankCbbConferences(
  teams: CbbTeam[],
  teamsById: Map<string, CbbTeam>,
  metrics: Map<string, CbbTeamMetrics>,
): CbbConferenceRank[] {
  const grouped = new Map<string, string[]>();
  for (const team of teams) {
    if (!isAutoBidConference(team.conference)) continue;
    const list = grouped.get(team.conference) ?? [];
    list.push(team.id);
    grouped.set(team.conference, list);
  }

  const rows = Array.from(grouped.entries()).map(([name, ids]) => {
    const teamIds = sortByMetrics(ids, teamsById, metrics);
    const { average, rankedCount } = conferenceAverage(teamIds, metrics);
    return {
      name,
      shortName: shortCbbConference(name),
      rank: 0,
      average,
      teamCount: teamIds.length,
      rankedCount,
      bestTeamId: teamIds[0] ?? null,
      teamIds,
    };
  });

  rows.sort((a, b) => {
    if (a.average != null && b.average != null && a.average !== b.average) {
      return a.average - b.average;
    }
    if (a.average != null && b.average == null) return -1;
    if (a.average == null && b.average != null) return 1;
    return a.shortName.localeCompare(b.shortName);
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
