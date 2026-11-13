"use client";

import { TeamLogo } from "@/components/TeamLogo";
import { assignField, bestTeamByConference } from "@/lib/cbb-bracket";
import {
  type FirstRoundSlot,
  type RegionBracket,
  type RegionId,
  placeBracket,
  REGION_META,
} from "@/lib/cbb-place-bracket";
import { formatRecord } from "@/lib/cbb-metrics";
import { PLAY_IN_GAMES } from "@/lib/cbb-season";
import type { CbbSnapshot, CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

const FIRST_ROUND_PAIRS: Array<[number, number]> = [
  [1, 16],
  [8, 9],
  [4, 13],
  [5, 12],
  [2, 15],
  [7, 10],
  [3, 14],
  [6, 11],
];

type Props = {
  teams: CbbTeam[];
  metrics: Map<string, CbbTeamMetrics>;
  conferences: string[];
  snapshots: CbbSnapshot[];
  viewingId: string | null;
  onViewingId: (id: string | null) => void;
};

function slotBySeed(region: RegionBracket, seed: number): FirstRoundSlot {
  return (
    region.slots.find((slot) => slot.seed === seed) ?? {
      seed,
      region: region.id,
      teamId: null,
      playIn: null,
      role: null,
      trueSeeds: [],
    }
  );
}

function chipColor(team: CbbTeam | undefined): string | undefined {
  if (!team?.color) return undefined;
  return team.color.startsWith("#") ? team.color : `#${team.color}`;
}

function TeamChip({
  team,
  seed,
  trueSeed,
  playIn,
}: {
  team: CbbTeam | undefined;
  seed: number;
  trueSeed?: number;
  playIn?: boolean;
}) {
  if (!team) {
    return (
      <div className="cbb-br-chip is-empty">
        <span className="cbb-br-seed">{seed}</span>
        <span className="cbb-br-name">—</span>
      </div>
    );
  }
  return (
    <div
      className="cbb-br-chip"
      style={{ ["--chip-color" as string]: chipColor(team) ?? "var(--turf)" }}
    >
      <span className="cbb-br-seed">{seed}</span>
      <TeamLogo team={team} />
      <span className="cbb-br-name">
        <strong>{team.shortName}</strong>
        <em>
          {formatRecord(team.wins, team.losses)}
          {trueSeed ? ` · #${trueSeed}` : ""}
          {playIn ? " · OR" : ""}
        </em>
      </span>
    </div>
  );
}

function SlotSide({
  slot,
  teamsById,
}: {
  slot: FirstRoundSlot;
  teamsById: Map<string, CbbTeam>;
}) {
  if (slot.playIn) {
    const [leftId, rightId] = slot.playIn.teamIds;
    return (
      <div className="cbb-br-or">
        <TeamChip team={teamsById.get(leftId)} seed={slot.seed} trueSeed={slot.trueSeeds[0]} playIn />
        <TeamChip team={teamsById.get(rightId)} seed={slot.seed} trueSeed={slot.trueSeeds[1]} playIn />
      </div>
    );
  }
  return (
    <TeamChip
      team={slot.teamId ? teamsById.get(slot.teamId) : undefined}
      seed={slot.seed}
      trueSeed={slot.trueSeeds[0]}
    />
  );
}

function RegionTree({
  region,
  teamsById,
  area,
  flip,
}: {
  region: RegionBracket;
  teamsById: Map<string, CbbTeam>;
  area: string;
  flip?: boolean;
}) {
  return (
    <section className={`cbb-br-region${flip ? " is-flip" : ""}`} style={{ gridArea: area }}>
      <header>
        <h3>{region.label}</h3>
        <span>
          {region.site} · {region.venue}
        </span>
      </header>
      <ol className="cbb-br-r64">
        {FIRST_ROUND_PAIRS.map(([high, low]) => {
          const left = slotBySeed(region, high);
          const right = slotBySeed(region, low);
          return (
            <li key={`${high}-${low}`} className="cbb-br-game">
              <SlotSide slot={left} teamsById={teamsById} />
              <SlotSide slot={right} teamsById={teamsById} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function BracketTab({
  teams,
  metrics,
  conferences,
  snapshots,
  viewingId,
  onViewingId,
}: Props) {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const latest = snapshots[0] ?? null;
  const viewing = snapshots.find((item) => item.id === viewingId) ?? latest;

  if (!viewing) {
    return (
      <div className="cbb-bracket-tab">
        <section className="panel">
          <header className="panel-header">
            <p className="eyebrow">Bracket</p>
            <h2>No seed list yet</h2>
            <p>
              Save a Bracketology projection, then this tab places that 76-team field into the 2027
              championship bracket — Opening Round through the Final Four.
            </p>
          </header>
        </section>
      </div>
    );
  }

  const assignment = assignField(
    viewing.sCurve,
    teamsById,
    conferences,
    bestTeamByConference(teams, teamsById, metrics),
  );
  const placed = placeBracket(assignment.field, teamsById);
  const sums = Object.values(placed.regions).map((region) => region.trueSeedSum);
  const spread = Math.max(...sums) - Math.min(...sums);

  return (
    <div className="cbb-bracket-tab">
      <section className="panel cbb-br-bar">
        <header className="panel-header">
          <p className="eyebrow">2027 NCAA bracket · {viewing.label}</p>
          <p>
            {placed.playInCount}/{PLAY_IN_GAMES} Opening Round games · overall 1 vs 4 and 2 vs 3 in
            Detroit · true-seed spread {spread} (prefer ≤6)
          </p>
        </header>
        <label className="week-select">
          Seed list
          <select value={viewing.id} onChange={(event) => onViewingId(event.target.value || null)}>
            {snapshots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.id === latest?.id ? " · latest" : ""}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="cbb-br-frame">
        <RegionTree region={placed.regions.east} teamsById={teamsById} area="east" />
        <RegionTree region={placed.regions.midwest} teamsById={teamsById} area="midwest" />
        <aside className="cbb-br-ff">
          <p>Final Four · Detroit</p>
          <div className="cbb-br-ff-game">
            <strong>{REGION_META.east.label}</strong>
            <span>vs</span>
            <strong>{REGION_META.midwest.label}</strong>
          </div>
          <div className="cbb-br-ff-game">
            <strong>{REGION_META.west.label}</strong>
            <span>vs</span>
            <strong>{REGION_META.south.label}</strong>
          </div>
          <ol className="cbb-br-balance">
            {(["east", "west", "south", "midwest"] as RegionId[]).map((id) => (
              <li key={id}>
                {placed.regions[id].label} {placed.regions[id].trueSeedSum}
              </li>
            ))}
          </ol>
        </aside>
        <RegionTree region={placed.regions.west} teamsById={teamsById} area="west" flip />
        <RegionTree region={placed.regions.south} teamsById={teamsById} area="south" flip />
      </div>
    </div>
  );
}
